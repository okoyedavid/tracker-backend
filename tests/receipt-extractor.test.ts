import assert from "node:assert/strict";
import test from "node:test";
import { createReceiptExtractor, extractDate, extractTotal } from "../src/modules/ocr/receipt-extractor";

const lines = (text: string) => text.split("\n").map(text => ({ text, confidencePercentage: null }));
const extract = (text: string) => createReceiptExtractor().extractReceipt({ text, model: "fixture", lines: lines(text) });

const totals: [string, number | null][] = [
  ["TOTAL 100.00\nTOTAL TAX 10.00\nTOTAL DISCOUNT 5.00", 100],
  ["Item 90.00\nTOTAL CASH 100.00", 100],
  ["Item 90.00\nTOTAL 100\nTAX 10.00", 100],
  ["TOTAL\nTAX 10.00", null],
  ["TOTAL ITEMS 12\nVISA 42.00", null],
  ["SUBTOTAL 90.00\nTAX 10.00\nTOTAL\n100.00", 100],
  ["Total NGN 2500", 2500],
  ["TOTAL \u20A62,500.00", 2500],
  ["TOTAL EUR 2.500,00", 2500],
  ["TOTAL 1,234", 1234],
  ["TOTAL -12.50", -12.5],
  ["TOTAL 12,50", 12.5],
  ["TOTAL: $17.75", 17.75],
  ["GRAND TOTAL 100.00\nTOTAL 80.00", 100],
  ["TOTAL 100.00\nCASH 200.00\nCHANGE 100.00", 100],
  ["Item 90.00\nCash tendered 100.00", null],
  ["TOTAL\n2026-11-16", null],
  ["TOTAL 10.00%", null],
  ["TOTAL DISCOUNT 5.00", null],
  ["TOTAL 0.00", 0],
  ["TOTAL 12,34.56", null],
];
for (const [input, expected] of totals) {
  test(`total: ${JSON.stringify(input)}`, () => assert.equal(extractTotal(lines(input)), expected));
}

const vendors: [string, string | null][] = [
  ["ORION MARKET\nStarbucks Coffee 8.00\nTOTAL 8.00", "ORION MARKET"],
  ["Invoice\nSupplier: Atlas Industrial Supplies\nBill to: Orion Ltd", "Atlas Industrial Supplies"],
  ["Bill to: Orion Ltd\nSupplier:\nAcme Logistics\nTOTAL 2500", "Acme Logistics"],
  ["Invoice\nBill to:\nOrion Ltd\nDescription\nPaper\nTOTAL 50.00", null],
  ["Invoice\nDescription\nStarbucks Coffee 8.00\nTOTAL 8.00", null],
  ["Lagos Office Equipment\nTOTAL 5000", "Lagos Office Equipment"],
  ["The Hardware Store\nTOTAL 100", "The Hardware Store"],
  ["Payee: Cloud Software Ltd\nTOTAL USD 20", "Cloud Software Ltd"],
  ["Issued by: Power Utility Ltd\nTOTAL 2000", "Power Utility Ltd"],
  ["Invoice\nBill to: Buyer Ltd\nTOTAL 2000", null],
  ["Supplier:\nBill to: Buyer Ltd\nTOTAL 2000", null],
];
for (const [input, expected] of vendors) {
  test(`vendor: ${JSON.stringify(input)}`, () => assert.equal(extract(input).vendor, expected));
}

test("uses transcript text when provider lines are empty", () => {
  assert.deepEqual(createReceiptExtractor().extractReceipt({
    text: "Atlas Supplies\n2026-11-16\nTotal 2500", model: "fixture", lines: [],
  }), { vendor: "Atlas Supplies", date: "2026-11-16", total: 2500 });
});

test("validates calendar dates", () => {
  assert.equal(extractDate("29/02/2025"), null);
  assert.equal(extractDate("29/02/2024"), "2024-02-29");
  assert.equal(extractDate("04/26/2025"), "2025-04-26");
});
