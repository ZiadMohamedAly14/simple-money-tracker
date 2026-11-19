# Money is stored as integer minor units

All amounts are whole numbers of the currency's smallest unit (for example piastres or cents), never floats. A budgeting app adds up thousands of small amounts, and float drift would make derived figures like Remaining show values a cent or so off. This deliberately differs from another project's `Number` + `toFixed(2)` pattern; don't "fix" it to match.
