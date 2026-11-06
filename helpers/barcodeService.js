const bwipjs = require('bwip-js');
const PDFDocument = require('pdfkit');

/**
 * Barcode & Label Service for Asia Direct Warehouse Tracking System
 * Supports:
 * - Alphanumeric Checksum calculation (Mod 10 / Luhn-variant)
 * - Barcode string generation according to standard: [WH]-[ORDER_REF]-[BOX]-[TOTAL]-[CHECKSUM]
 * - Honeywell ZPL generation (4"x6", 203 DPI standard for Honeywell PC42t / PM43 / PX4ie)
 * - Multi-page 4"x6" PDF Label generation using PDFKit + bwip-js (Vector / high-res thermal)
 */

class BarcodeService {
    /**
     * Calculates a Mod-10 alphanumeric checksum character.
     * @param {string} str - Raw barcode base string (e.g. 'CAN-WO00233-001-025')
     * @returns {string} Single digit or uppercase check character
     */
    static calculateChecksum(str) {
        const cleaned = (str || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        let sum = 0;
        for (let i = 0; i < cleaned.length; i++) {
            const code = cleaned.charCodeAt(i);
            const weight = (i % 2 === 0) ? 3 : 1;
            sum += code * weight;
        }
        const mod = sum % 10;
        return ((10 - mod) % 10).toString();
    }

    /**
     * Verifies if a barcode has a valid checksum.
     * @param {string} barcode 
     * @returns {boolean}
     */
    static verifyChecksum(barcode) {
        if (!barcode || typeof barcode !== 'string') return false;
        const parts = barcode.trim().split('-');
        if (parts.length < 2) return false;
        const providedChecksum = parts[parts.length - 1];
        const base = parts.slice(0, -1).join('-');
        const expectedChecksum = this.calculateChecksum(base);
        return providedChecksum === expectedChecksum;
    }

    /**
     * Builds standard barcode string: [WH_PREFIX]-[ORDER_REF]-[BOX_NUM]-[TOTAL_BOXES]-[CHECKSUM]
     * E.g. 'CAN-WO00233-001-025-7'
     */
    static buildBarcodeString({ warehouseRef, orderNumber, boxNumber, totalBoxes }) {
        if (!warehouseRef || typeof warehouseRef !== 'string' || !warehouseRef.trim()) {
            throw new Error('warehouseRef is required to build barcode string');
        }
        if (!orderNumber || typeof orderNumber !== 'string' || !orderNumber.trim()) {
            throw new Error('orderNumber is required to build barcode string');
        }
        const bNum = parseInt(boxNumber, 10);
        const tBoxes = parseInt(totalBoxes, 10);
        if (isNaN(bNum) || bNum < 1) {
            throw new Error('boxNumber must be a positive integer >= 1');
        }
        if (isNaN(tBoxes) || tBoxes < 1 || bNum > tBoxes) {
            throw new Error('totalBoxes must be a positive integer >= boxNumber');
        }

        const cleanWh = warehouseRef.replace(/[^A-Za-z0-9]/g, '').toUpperCase().substring(0, 4);
        const cleanOrder = orderNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const padBox = String(bNum).padStart(3, '0');
        const padTotal = String(tBoxes).padStart(3, '0');

        const baseString = `${cleanWh}-${cleanOrder}-${padBox}-${padTotal}`;
        const checksum = this.calculateChecksum(baseString);
        return `${baseString}-${checksum}`;
    }

    /**
     * Generates standard Honeywell-compatible ZPL string for a single box label.
     * Dimensions: 4" x 6" (812 x 1218 dots at 203 DPI)
     */
    static generateZplLabel(boxData) {
        const {
            barcode_string = 'CAN-WO0001-001-001-0',
            box_number = 1,
            total_boxes = 1,
            warehouse_order_number = 'WO0001',
            origin_name = 'CHINA WAREHOUSE',
            destination_name = 'SOUTH AFRICA',
            customer_name = 'N/A',
            supplier_name = 'N/A',
            freight_type = 'CONSOLIDATED FREIGHT',
            weight_kg = 0,
            cbm = 0,
            description = 'General Cargo'
        } = boxData;

        return `
^XA
^PW812
^LL1218
^LH0,0
^CI28

~SD20

^FO30,30^GB752,1158,4^FS

^FO50,55^A0N,38,38^FDASIA DIRECT FREIGHT & TRACKING^FS
^FO50,98^A0N,24,24^FDORIGIN: ${origin_name.toUpperCase()} -> DEST: ${destination_name.toUpperCase()}^FS
^FO30,135^GB752,3,3^FS

^FO50,155^GB712,120,3^FS
^FO70,170^A0N,26,26^FPPACKAGE / CARTON^FS
^FO70,205^A0N,60,60^FDBOX ${box_number} OF ${total_boxes}^FS
^FO540,185^BQN,2,4^FDQA,${barcode_string}^FS

^FO50,305^BY3,3,125^BCN,125,Y,N,N^FD>:${barcode_string}^FS

^FO30,480^GB752,3,3^FS

^FO50,510^A0N,28,28^FDORDER REF:^FS
^FO220,510^A0N,28,28^FD${warehouse_order_number}^FS

^FO50,560^A0N,28,28^FDSUPPLIER:^FS
^FO220,560^A0N,28,28^FD${(supplier_name || 'N/A').substring(0, 32)}^FS

^FO50,610^A0N,28,28^FDCUSTOMER:^FS
^FO220,610^A0N,28,28^FD${(customer_name || 'N/A').substring(0, 32)}^FS

^FO50,660^A0N,28,28^FDWEIGHT / CBM:^FS
^FO220,660^A0N,28,28^FD${weight_kg ? weight_kg + ' KG' : 'TBD'}  |  ${cbm ? cbm + ' CBM' : 'TBD'}^FS

^FO50,710^A0N,28,28^FDCARGO TYPE:^FS
^FO220,710^A0N,28,28^FD${freight_type.toUpperCase()}^FS

^FO50,760^A0N,28,28^FDDESCRIPTION:^FS
^FO220,760^A0N,26,26^FD${(description || 'General Goods').substring(0, 35)}^FS

^FO30,830^GB752,3,3^FS

^FO50,860^A0N,24,24^FDSCAN VIA ASIA DIRECT MOBILE SCANNER / HONEYWELL EDA52^FS
^FO50,895^A0N,20,20^FDSYSTEM GENERATED LABEL - DO NOT COVER OR MUTILATE^FS

^XZ
        `.trim();
    }

    /**
     * Generates a combined ZPL string for all boxes in a shipment.
     */
    static generateMultiZplLabels(boxesDataList) {
        return boxesDataList.map(box => this.generateZplLabel(box)).join('\n\n');
    }

    /**
     * Renders a Code 128 barcode image buffer via bwip-js.
     */
    static async generateBarcodeImageBuffer(barcodeString) {
        return bwipjs.toBuffer({
            bcid: 'code128',
            text: barcodeString,
            scale: 3,
            height: 14,
            includetext: true,
            textxalign: 'center',
            textsize: 11,
            textyoffset: -5,
            paddingbottom: 6,
            paddingtop: 2,
            paddingleft: 4,
            paddingright: 4
        });
    }

    /**
     * Renders a 2D QR code buffer via bwip-js.
     */
    static async generateQrCodeBuffer(barcodeString) {
        return bwipjs.toBuffer({
            bcid: 'qrcode',
            text: barcodeString,
            scale: 3
        });
    }

    /**
     * Generates a 4" x 6" PDF containing printable thermal labels for an array of boxes.
     * Dimensions in points: 4 in * 72 pt/in = 288 pt; 6 in * 72 pt/in = 432 pt.
     * @param {Array<Object>} boxes - List of box records
     * @param {Object} meta - Consignment / Order metadata
     * @param {WritableStream} outputStream - Express response or file stream
     */
    static async generatePdfLabels(boxes, meta, outputStream) {
        const doc = new PDFDocument({
            size: [288, 432], // 4" x 6" in PostScript points
            margins: { top: 12, bottom: 12, left: 12, right: 12 },
            autoFirstPage: false
        });

        doc.pipe(outputStream);

        for (let i = 0; i < boxes.length; i++) {
            const box = boxes[i];
            doc.addPage();

            // Outer label border
            doc.lineWidth(1.5).rect(12, 12, 264, 408).stroke('#1e293b');

            // Header banner
            doc.rect(12, 12, 264, 38).fill('#0f172a');
            doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold')
                .text('ASIA DIRECT LOGISTICS', 18, 18, { width: 252, align: 'left' });
            doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
                .text(`ORIGIN: ${(meta.origin_name || 'CHINA').toUpperCase()}  ➔  DEST: ${(meta.destination_name || 'AFRICA HUB').toUpperCase()}`, 18, 33);

            // Box Badge
            doc.rect(18, 56, 252, 42).fillAndStroke('#f8fafc', '#cbd5e1');
            doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold')
                .text('CONSIGNMENT PACKAGE', 26, 62);
            doc.fillColor('#0284c7').fontSize(18).font('Helvetica-Bold')
                .text(`BOX ${box.box_number} OF ${box.total_boxes}`, 26, 74);

            // Generate Barcode image
            try {
                const barcodeBuffer = await this.generateBarcodeImageBuffer(box.barcode_string);
                doc.image(barcodeBuffer, 22, 106, { width: 244, height: 74 });
            } catch (err) {
                // Fallback text if rendering fails
                doc.fillColor('#dc2626').fontSize(10).text(box.barcode_string, 26, 125);
            }

            // Divider line
            doc.lineWidth(0.5).moveTo(18, 192).lineTo(270, 192).stroke('#cbd5e1');

            // Metadata key-value grid
            const drawRow = (y, label, val) => {
                doc.fillColor('#64748b').fontSize(7.5).font('Helvetica-Bold').text(label, 22, y, { width: 80 });
                doc.fillColor('#0f172a').fontSize(8).font('Helvetica').text(val || 'N/A', 105, y, { width: 165, ellipsis: true });
            };

            let rowY = 202;
            drawRow(rowY, 'ORDER REF:', meta.warehouse_order_number || meta.order_number || 'N/A');
            rowY += 16;
            drawRow(rowY, 'SUPPLIER:', meta.supplier_name || 'N/A');
            rowY += 16;
            drawRow(rowY, 'CUSTOMER:', meta.customer_name || 'N/A');
            rowY += 16;
            drawRow(rowY, 'WEIGHT (KG):', box.weight_kg ? `${box.weight_kg} KG` : (meta.total_weight ? `${meta.total_weight} KG (Total)` : 'TBD'));
            rowY += 16;
            drawRow(rowY, 'CBM / VOL:', box.cbm ? `${box.cbm} m³` : (meta.total_cbm ? `${meta.total_cbm} m³` : 'TBD'));
            rowY += 16;
            drawRow(rowY, 'FREIGHT TYPE:', (meta.freight_type || meta.freight || 'CONSOLIDATED').toUpperCase());
            rowY += 16;
            drawRow(rowY, 'DESCRIPTION:', meta.goods_description || meta.product_description || 'General Goods');

            // QR Code at bottom corner
            try {
                const qrBuffer = await this.generateQrCodeBuffer(box.barcode_string);
                doc.image(qrBuffer, 205, 332, { width: 62, height: 62 });
            } catch (err) {
                // ignore qr error
            }

            // Footer notes
            doc.fillColor('#0f172a').fontSize(7).font('Helvetica-Bold')
                .text('SCAN WITH ASIA DIRECT APP', 22, 342);
            doc.fillColor('#64748b').fontSize(6.5).font('Helvetica')
                .text('Honeywell EDA52 / Camera Compatible', 22, 354)
                .text(`Generated: ${new Date().toISOString().substring(0, 16).replace('T', ' ')}`, 22, 366)
                .text(`Status: ${(box.current_status || 'GENERATED').toUpperCase()}`, 22, 378);
        }

        doc.end();
    }
}

module.exports = BarcodeService;
