const { query } = require("./dbQuery");

/**
 * Set tbl_invoices.payment to the customer receipts still linked to this
 * order, then rebuild balance. Also keeps quote_invoice in step.
 * Called after a cashbook row is deleted, edited, or moved off the order.
 */
async function recalcOrderPayment(orderId) {
    const id = Number(orderId);
    if (!id) return null;

    const totals = await query(
        `
        SELECT COALESCE(SUM(COALESCE(receipt, 0)), 0) AS total_receipt
        FROM tbl_cashbook
        WHERE order_id = ?
          AND allocation_type = 'Customer'
        `,
        [id]
    );

    const totalReceipt = Number(totals[0]?.total_receipt) || 0;

    await query(
        `
        UPDATE tbl_invoices
        SET
            payment = ?,
            balance = COALESCE(invoice_amt, 0) - ?,
            status = CASE WHEN ? > 0 THEN 'Part Paid' ELSE NULL END
        WHERE order_id = ?
        `,
        [totalReceipt, totalReceipt, totalReceipt, id]
    );

    await query(
        `
        UPDATE quote_invoice
        SET
            balance = GREATEST(
                COALESCE(
                    NULLIF(sumof_vatincl, 0),
                    NULLIF(sumof_finalamount, 0),
                    NULLIF(chargeable, 0),
                    0
                ) - ?,
                0
            ),
            status = CASE
                WHEN COALESCE(
                    NULLIF(sumof_vatincl, 0),
                    NULLIF(sumof_finalamount, 0),
                    NULLIF(chargeable, 0),
                    0
                ) > 0
                AND ? >= COALESCE(
                    NULLIF(sumof_vatincl, 0),
                    NULLIF(sumof_finalamount, 0),
                    NULLIF(chargeable, 0),
                    0
                )
                    THEN 'Paid'
                WHEN ? > 0 THEN 'Part Paid'
                ELSE 'Unpaid'
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE order_id = ?
          AND is_deleted = 0
        `,
        [totalReceipt, totalReceipt, totalReceipt, id]
    );

    return { order_id: id, payment: totalReceipt };
}

/**
 * Rebuild a supplier invoice payment from the supplier cashbook rows
 * still pointing at it. Missing invoice is ignored so a delete can finish.
 */
async function recalcSupplierInvoicePayment(supplierInvoiceId) {
    const id = Number(supplierInvoiceId);
    if (!id) return null;

    const invoices = await query(
        `
        SELECT id, sumof_vatincl
        FROM supplier_shipment_invoice
        WHERE id = ?
        LIMIT 1
        `,
        [id]
    );

    if (invoices.length === 0) return null;

    const totals = await query(
        `
        SELECT COALESCE(SUM(COALESCE(receipt, 0)), 0) AS total_payment
        FROM tbl_cashbook
        WHERE allocation_type = 'Supplier'
          AND supplier_invoice_id = ?
        `,
        [id]
    );

    const totalPayment = Number(totals[0]?.total_payment) || 0;
    const invoiceAmount = Number(invoices[0].sumof_vatincl) || 0;
    const balance = Math.max(invoiceAmount - totalPayment, 0);

    let status = "unpaid";
    if (totalPayment > 0 && balance > 0) status = "Part Paid";
    if (balance <= 0 && totalPayment > 0) status = "Paid";

    await query(
        `
        UPDATE supplier_shipment_invoice
        SET payment = ?, balance = ?, status = ?
        WHERE id = ?
        `,
        [totalPayment, balance, status, id]
    );

    return { supplier_invoice_id: id, payment: totalPayment, balance, status };
}

module.exports = {
    recalcOrderPayment,
    recalcSupplierInvoicePayment,
};
