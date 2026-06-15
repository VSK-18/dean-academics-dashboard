const ExcelJS = require('exceljs');

function colLetterToNumber(letter) {
    let col = 0;
    for (let i = 0; i < letter.length; i++) {
        col = col * 26 + (letter.charCodeAt(i) - 64);
    }
    return col;
}

function colNumberToLetter(col) {
    let letter = '';
    while (col > 0) {
        let temp = (col - 1) % 26;
        letter = String.fromCharCode(65 + temp) + letter;
        col = Math.floor((col - temp) / 26);
    }
    return letter;
}

function translateFormula(formula, srcAddr, destAddr) {
    const srcMatch = srcAddr.match(/^([A-Z]+)([0-9]+)$/);
    const destMatch = destAddr.match(/^([A-Z]+)([0-9]+)$/);
    if (!srcMatch || !destMatch) return formula;
    
    const srcCol = colLetterToNumber(srcMatch[1]);
    const srcRow = parseInt(srcMatch[2], 10);
    const destCol = colLetterToNumber(destMatch[1]);
    const destRow = parseInt(destMatch[2], 10);
    
    const colOffset = destCol - srcCol;
    const rowOffset = destRow - srcRow;
    
    if (colOffset === 0 && rowOffset === 0) return formula;
    
    return formula.replace(/(\$?([A-Z]+))(\$?([0-9]+))/g, (match, colPart, colName, rowPart, rowNumStr) => {
        const isColAbsolute = colPart.startsWith('$');
        const isRowAbsolute = rowPart.startsWith('$');
        
        let newColName = colName;
        if (!isColAbsolute) {
            const colNum = colLetterToNumber(colName);
            newColName = colNumberToLetter(colNum + colOffset);
        }
        
        let newRowNum = rowNumStr;
        if (!isRowAbsolute) {
            const rowNum = parseInt(rowNumStr, 10);
            newRowNum = String(rowNum + rowOffset);
        }
        
        return (isColAbsolute ? '$' : '') + newColName + (isRowAbsolute ? '$' : '') + newRowNum;
    });
}

function flattenSharedFormulas(ws) {
    const masters = {};
    ws.eachRow({ includeEmpty: true }, (row) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
            const val = cell.value;
            if (val && val.shareType === 'shared' && val.ref && val.formula) {
                masters[cell.address] = {
                    formula: val.formula,
                    ref: val.ref,
                    address: cell.address
                };
            }
        });
    });

    ws.eachRow({ includeEmpty: true }, (row) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
            const val = cell.value;
            if (val) {
                if (val.shareType === 'shared') {
                    cell.value = { formula: val.formula };
                } else if (val.sharedFormula) {
                    const masterAddr = val.sharedFormula;
                    const master = masters[masterAddr];
                    if (master) {
                        const translated = translateFormula(master.formula, master.address, cell.address);
                        cell.value = { formula: translated };
                    } else {
                        cell.value = null;
                    }
                }
            }
        });
    });
}

/**
 * Replicates the logic of export_excel.py using exceljs
 * @param {Array} proposals - List of proposals
 * @param {string} templatePath - Path to the input template .xlsx file
 * @param {string} outputPath - Path where the modified .xlsx should be saved
 */
async function exportExcel(proposals, templatePath, outputPath) {
    // Sort proposals by date
    const sortedProposals = [...proposals].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    // Load Excel Workbook
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    // 1. Populate AAF-MONITOR and EQA-Monitor
    for (const cat of ['AAF', 'EQA']) {
        const sheetName = cat === 'AAF' ? 'AAF-MONITOR' : 'EQA-Monitor';
        const ws = workbook.getWorksheet(sheetName);
        if (!ws) continue;

        // Flatten shared formulas to regular formulas to prevent exceljs save errors
        flattenSharedFormulas(ws);

        // Find insertion row (we look for the row containing "Total Proposed" in Column F)
        let totalRowIdx = null;
        for (let r = 20; r <= 100; r++) {
            const val = ws.getCell(r, 6).value; // Column F is 6
            if (val && String(val).toLowerCase().includes("total")) {
                totalRowIdx = r;
                break;
            }
        }

        if (!totalRowIdx) {
            totalRowIdx = 33;
        }

        // Get transactions for this category
        const catProposals = sortedProposals.filter(p => p.category === cat);
        const numRecords = catProposals.length;

        // Clear existing demo rows first (rows 23 to total_row_idx-1)
        // Note: B is 2, C is 3, D is 4, F is 6, G is 7, H is 8, K is 11, L is 12, M is 13
        for (let r = 23; r < totalRowIdx; r++) {
            ws.getCell(r, 2).value = null;
            ws.getCell(r, 3).value = null;
            ws.getCell(r, 4).value = null;
            ws.getCell(r, 6).value = null;
            ws.getCell(r, 7).value = null;
            ws.getCell(r, 8).value = null;
            ws.getCell(r, 11).value = null;
            ws.getCell(r, 12).value = null;
            ws.getCell(r, 13).value = null;
            // Do not touch Column N (14) which contains formulas: =N(r-1) - K(r)
        }

        // If the number of records is larger than the available rows, insert rows
        const availableRows = (totalRowIdx - 1) - 23 + 1;
        if (numRecords > availableRows) {
            const diff = numRecords - availableRows;
            
            // Insert empty rows
            for (let i = 0; i < diff; i++) {
                const insertRowIdx = totalRowIdx - 1 + i;
                ws.insertRow(insertRowIdx, []);
            }
            
            // Update total row index
            totalRowIdx += diff;
        }

        // Replicate styles of row 23 to all data rows (from 24 up to 23 + numRecords - 1)
        const srcRow = ws.getRow(23);
        if (numRecords > 1) {
            for (let r = 24; r <= 23 + numRecords - 1; r++) {
                const destRow = ws.getRow(r);
                destRow.height = srcRow.height;
                for (let c = 1; c <= 14; c++) {
                    // Copy font, fill, border, alignment, numberFormat etc.
                    destRow.getCell(c).style = srcRow.getCell(c).style;
                }
            }
        }

        // Now fill in the data
        catProposals.forEach((p, idx) => {
            const rowNum = 23 + idx;

            // Format date to DD.MM.YYYY
            let formattedDate = p.date || '';
            if (formattedDate && formattedDate.includes('-')) {
                try {
                    const dateParts = formattedDate.split('-');
                    if (dateParts.length === 3) {
                        formattedDate = `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}`;
                    }
                } catch (e) {
                    // Keep original
                }
            }

            ws.getCell(rowNum, 2).value = p.id || '';
            ws.getCell(rowNum, 3).value = formattedDate;
            ws.getCell(rowNum, 4).value = p.comp || '';
            ws.getCell(rowNum, 6).value = p.dept || '';
            ws.getCell(rowNum, 7).value = p.subHead || '';
            ws.getCell(rowNum, 8).value = typeof p.amountProposed === 'number' ? p.amountProposed : parseFloat(p.amountProposed || 0);
            ws.getCell(rowNum, 11).value = typeof p.actualExpenditure === 'number' ? p.actualExpenditure : parseFloat(p.actualExpenditure || 0);
            ws.getCell(rowNum, 12).value = p.month || '';
            ws.getCell(rowNum, 13).value = p.remarks || '';

            // Ensure balance formula exists in Column N (14)
            if (rowNum > 23) {
                ws.getCell(rowNum, 14).value = { formula: `N${rowNum - 1}-K${rowNum}` };
            } else {
                ws.getCell(rowNum, 14).value = { formula: cat === 'AAF' ? '6200000-K23' : '10000000-K23' };
            }
        });
    }

    // 2. Populate Monthly Sheet
    const wsMonthly = workbook.getWorksheet('Monthly');
    if (wsMonthly) {
        // Flatten shared formulas to regular formulas
        flattenSharedFormulas(wsMonthly);

        // Clear existing contents starting at row 2
        const maxRow = wsMonthly.rowCount;
        if (maxRow >= 2) {
            for (let r = 2; r <= maxRow; r++) {
                const row = wsMonthly.getRow(r);
                for (let col = 1; col <= 14; col++) {
                    row.getCell(col).value = null;
                }
            }
        }

        // Write fresh data
        const aafProposals = sortedProposals.filter(p => p.category === 'AAF');
        const eqaProposals = sortedProposals.filter(p => p.category === 'EQA');
        const totalMonthlyRows = Math.max(aafProposals.length, eqaProposals.length);

        const srcRowMonthly = wsMonthly.getRow(2);

        for (let idx = 0; idx < totalMonthlyRows; idx++) {
            const rowNum = 2 + idx;
            const destRow = wsMonthly.getRow(rowNum);

            // Replicate style from row 2 for newly populated rows
            if (rowNum > 2 && srcRowMonthly) {
                destRow.height = srcRowMonthly.height;
                for (let c = 1; c <= 14; c++) {
                    destRow.getCell(c).style = srcRowMonthly.getCell(c).style;
                }
            }

            // Write AAF
            if (idx < aafProposals.length) {
                const p = aafProposals[idx];
                destRow.getCell(1).value = p.date || '';
                destRow.getCell(3).value = p.id || '';
                destRow.getCell(4).value = p.comp || '';
                destRow.getCell(5).value = p.dept || '';
                destRow.getCell(6).value = typeof p.actualExpenditure === 'number' ? p.actualExpenditure : parseFloat(p.actualExpenditure || 0);
            }

            // Write EQA
            if (idx < eqaProposals.length) {
                const p = eqaProposals[idx];
                destRow.getCell(8).value = p.date || '';
                destRow.getCell(10).value = p.id || '';
                destRow.getCell(11).value = p.comp || '';
                destRow.getCell(12).value = p.dept || '';
                destRow.getCell(13).value = typeof p.actualExpenditure === 'number' ? p.actualExpenditure : parseFloat(p.actualExpenditure || 0);
            }
        }
    }

    // Save output
    await workbook.xlsx.writeFile(outputPath);
}

module.exports = { exportExcel };
