# Money Tracker

A personal money-tracking app for adults managing a monthly budget with virtual money, plus a Kid Wallet experience where a parent funds and supervises a child's virtual money.

## Accounts & Devices

**Account**:
The single adult-owned identity, signed into by email one-time code. Owns the Personal Budget and all Kid Profiles.
_Avoid_: User (when meaning the data owner), parent account

**Kid Profile**:
A child managed under an Account. Has no login of its own and owns exactly one Kid Wallet.
_Avoid_: Child account, kid user

**Device Mode**:
Whether a device presents the Personal experience or the Kid experience for one specific Kid Profile.
_Avoid_: App mode, user type

**Parent PIN**:
The secret (or device biometrics in its place) required to leave Kid Mode or enter the Parent Area.
_Avoid_: Password, passcode

**Parent Area**:
The protected section where the adult tops up and reviews a Kid Wallet.
_Avoid_: Admin, parent dashboard

**Kid Session**:
The narrowed sign-in a Kid-Mode device holds, limited to one Kid Profile.
_Avoid_: Kid login, kid account

## Personal Budget

**Month**:
A calendar month; the unit of budgeting. Each Month starts fresh with no carry-over.
_Avoid_: Period, cycle

**Expected Income**:
The amount the adult plans to receive in a Month, used to allocate Category Budgets. Defaults from the previous Month.
_Avoid_: Salary, monthly income (ambiguous)

**Income**:
The sum of Income transactions actually recorded in a Month.
_Avoid_: Earnings, revenue

**Spending**:
The sum of Expense transactions recorded in a Month.
_Avoid_: Costs, outflow

**Remaining**:
The larger of Expected Income and Income for a Month, minus Spending: what is left to spend. Income that hasn't arrived yet doesn't lower it, and Income above the plan raises it. Category Budgets don't count as spent. Always derived, never entered. May be negative.
_Avoid_: Balance, money left

**Category**:
A named bucket that every Expense belongs to. **Other** is the default catch-all. An **Archived** Category is hidden from new Months but kept in history. A **Deleted** Category is gone for good: its Expenses show as Other, and its Category Budgets are removed. The app always keeps at least one Category besides Other.
_Avoid_: Tag, envelope

**Category Budget**:
The amount allocated to a Category for a specific Month.
_Avoid_: Limit, allocation

**Unallocated**:
Expected Income minus the sum of Category Budgets for a Month. May be negative.
_Avoid_: Free money, unassigned

**Transaction**:
A dated record of money moving, either an **Income** or an **Expense** (personal), or a **Top-up** or **Kid Expense** (kid).
_Avoid_: Entry, record, payment

## Kid Wallet

**Kid Wallet**:
A Kid Profile's running, non-monthly store of virtual money, split into Jars.
_Avoid_: Kid account, allowance account

**Jar**:
A portion of a Kid Wallet with its own balance (defaults: Save, Spend, Give). Kid Expenses come out of a Jar.
_Avoid_: Category (in kid context), pot, envelope

**Top-up**:
Money a parent adds to a Kid Wallet, split across Jars. Only the parent can create or change it.
_Avoid_: Allowance, deposit, transfer

**Kid Expense**:
Money a kid records as spent from a Jar. The app never lets one exceed the Jar's balance. That check runs on the device only: the server accepts any Kid Expense (last edit wins), so two offline devices can take a Jar below zero, and the app then blocks spending from it until it's topped up.
_Avoid_: Purchase, kid transaction

**Jar Transfer**:
A parent moving money from one Jar to another within the same Kid Wallet.
_Avoid_: Reallocation, move
