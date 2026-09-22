import cv2
import numpy as np
from PIL import Image


class ImagePreprocessor:
    @staticmethod
    def pil_to_cv2(pil_img: Image.Image) -> np.ndarray:
        return cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

    @staticmethod
    def cv2_to_pil(cv_img: np.ndarray) -> Image.Image:
        if len(cv_img.shape) == 2:
            return Image.fromarray(cv_img)
        return Image.fromarray(cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB))

    @classmethod
    def enhance_for_ocr(cls, pil_img: Image.Image, pass_num: int = 1) -> Image.Image:
        """
        Applies staged preprocessing passes:
        Pass 1: Grayscale + Gentle Bilateral Denoising + Otsu Thresholding
        Pass 2: CLAHE Contrast enhancement + Adaptive Gaussian Thresholding
        Pass 3: Deskew + Morphological noise reduction
        """
        img_cv = cls.pil_to_cv2(pil_img)
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)

        if pass_num == 1:
            # Denoise and Otsu thresholding
            denoised = cv2.bilateralFilter(gray, 9, 75, 75)
            _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            return cls.cv2_to_pil(thresh)

        elif pass_num == 2:
            # Contrast Limited Adaptive Histogram Equalization (CLAHE)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(gray)
            adaptive = cv2.adaptiveThreshold(
                enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 15, 8
            )
            return cls.cv2_to_pil(adaptive)

        else:
            # Deskew pass
            deskewed = cls.deskew(gray)
            _, thresh = cv2.threshold(deskewed, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            return cls.cv2_to_pil(thresh)

    @classmethod
    def deskew(cls, gray_cv: np.ndarray) -> np.ndarray:
        """Corrects skew angle up to ±45 degrees."""
        try:
            thresh = cv2.threshold(gray_cv, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
            coords = np.column_stack(np.where(thresh > 0))
            if len(coords) < 100:
                return gray_cv
            
            angle = cv2.minAreaRect(coords)[-1]
            if angle < -45:
                angle = -(90 + angle)
            else:
                angle = -angle

            if abs(angle) < 0.5 or abs(angle) > 45:
                return gray_cv

            (h, w) = gray_cv.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            rotated = cv2.warpAffine(gray_cv, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
            return rotated
        except Exception:
            return gray_cv
