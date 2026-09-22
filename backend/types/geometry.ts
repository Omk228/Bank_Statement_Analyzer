export interface BoundingBox {
  x0: number; // left
  y0: number; // top
  x1: number; // right
  y1: number; // bottom
}

export interface SpatialWordToken {
  text: string;
  bbox: BoundingBox;
  confidence: number;
  pageNumber: number;
  lineIndex?: number;
}

export interface SpatialLineToken {
  text: string;
  bbox: BoundingBox;
  words: SpatialWordToken[];
  pageNumber: number;
}

export interface PageGeometry {
  pageNumber: number;
  width: number;
  height: number;
  words: SpatialWordToken[];
  lines: SpatialLineToken[];
}

export type TableColumnType =
  | 'DATE'
  | 'DESCRIPTION'
  | 'REFERENCE'
  | 'DEBIT'
  | 'CREDIT'
  | 'BALANCE';

export interface TableColumnRegion {
  type: TableColumnType;
  headerText: string;
  bbox: BoundingBox;
  x0: number;
  x1: number;
  center: number;
}

export interface SpatialRowSlice {
  y0: number;
  y1: number;
  yCenter: number;
  tokens: SpatialWordToken[];
  cells: { [key in TableColumnType]?: string };
}
