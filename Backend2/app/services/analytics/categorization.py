import re
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Tuple, Dict, Any
from ...models.transaction import NormalizedTransaction
from ...models.analytics import CategoryAnalysis, CategoryItem


class CategorizationEngine:
    PAYMENT_MODES = [
        ('UPI', r'\b(upi|gpay|phonepe|paytm|bhim)\b'),
        ('NEFT', r'\bneft\b'),
        ('IMPS', r'\bimps\b'),
        ('RTGS', r'\brtgs\b'),
        ('ATM', r'\b(atm|nfs|cash\s*wdl)\b'),
        ('POS', r'\b(pos|ecom|swiped)\b'),
        ('ACH', r'\b(ach|nach|mandate)\b'),
        ('CHEQUE', r'\b(chq|cheque|clearing)\b'),
        ('CARD', r'\b(card|visa|mastercard|rupay)\b'),
    ]

    CATEGORY_RULES = [
        ('RE_05', 'Salary / Income', r'\b(salary|payroll|sprinklr|wipro|infosys|tcs|google|amazon|monthly\s*pay)\b', 'CREDIT'),
        ('FD_00', 'Dining & Food', r'\b(swiggy|zomato|mcdonald|starbucks|domino|restaurant|cafe|food)\b', 'DEBIT'),
        ('FD_01', 'Groceries', r'\b(blinkit|zepto|instamart|dmart|bigbasket|supermarket|grocery)\b', 'DEBIT'),
        ('SH_00', 'Shopping', r'\b(amazon|flipkart|myntra|ajio|meesho|nykaa|retail|store)\b', 'DEBIT'),
        ('BL_01', 'Utilities', r'\b(airtel|jio|vi|electricity|bescom|water|gas|bill\s*desk|recharge)\b', 'DEBIT'),
        ('LO_03', 'Loan EMI', r'\b(emi|loan|bajaj\s*finance|muthoot|repayment|instalment)\b', 'DEBIT'),
        ('TR_07', 'Travel & Fuel', r'\b(uber|ola|rapido|irctc|makemytrip|petrol|fuel|hpcl|bpcl|ioc)\b', 'DEBIT'),
        ('HF_06', 'Healthcare', r'\b(apollo|pharmacy|1mg|netmeds|hospital|clinic|medplus|doctor)\b', 'DEBIT'),
        ('IN_03', 'Insurance', r'\b(lic|hdfc\s*ergo|icici\s*lombard|star\s*health|insurance)\b', 'DEBIT'),
        ('OO_02', 'Cash Withdrawal', r'\b(atm|cash\s*wdl|cash\s*withdrawal)\b', 'DEBIT'),
        ('RE_17', 'Inward Transfer', r'\b(upi|inward|imps|neft)\b', 'CREDIT'),
        ('OO_03', 'P2P Transfer', r'\b(upi|transfer|paid\s*to)\b', 'DEBIT'),
    ]

    @classmethod
    def categorize_transactions(cls, transactions: List[NormalizedTransaction]) -> CategoryAnalysis:
        income_map: Dict[str, CategoryItem] = {}
        expense_map: Dict[str, CategoryItem] = {}

        total_income = sum([t.credit for t in transactions if t.credit > Decimal('0.00')], Decimal('0.00')) or Decimal('1.00')
        total_expense = sum([t.debit for t in transactions if t.debit > Decimal('0.00')], Decimal('0.00')) or Decimal('1.00')

        for t in transactions:
            mode = cls._detect_mode(t.description)
            cat_code, cat_name = cls._detect_category(t.description, t.type)
            
            t.payment_mode = mode
            t.category_code = cat_code
            t.category_name = cat_name

            if t.type == 'CREDIT' and t.credit > Decimal('0.00'):
                if cat_code not in income_map:
                    income_map[cat_code] = CategoryItem(code=cat_code, name=cat_name, amount=Decimal('0.00'), count=0)
                income_map[cat_code].amount = (income_map[cat_code].amount + t.credit).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                income_map[cat_code].count += 1
            elif t.type == 'DEBIT' and t.debit > Decimal('0.00'):
                if cat_code not in expense_map:
                    expense_map[cat_code] = CategoryItem(code=cat_code, name=cat_name, amount=Decimal('0.00'), count=0)
                expense_map[cat_code].amount = (expense_map[cat_code].amount + t.debit).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                expense_map[cat_code].count += 1

        for item in income_map.values():
            item.percentage = round(float(item.amount / total_income) * 100, 2)
        for item in expense_map.values():
            item.percentage = round(float(item.amount / total_expense) * 100, 2)

        return CategoryAnalysis(
            income_categories=list(income_map.values()),
            expense_categories=list(expense_map.values()),
        )

    @classmethod
    def _detect_mode(cls, desc: str) -> str:
        clean = desc.lower()
        for mode, pat in cls.PAYMENT_MODES:
            if re.search(pat, clean):
                return mode
        return 'OTHER'

    @classmethod
    def _detect_category(cls, desc: str, txn_type: str) -> Tuple[str, str]:
        clean = desc.lower()
        for code, name, pat, req_type in cls.CATEGORY_RULES:
            if txn_type == req_type and re.search(pat, clean):
                return code, name

        if txn_type == 'CREDIT':
            return 'RE_07', 'General Inflow'
        return 'ZZ_99', 'General Outflow'

