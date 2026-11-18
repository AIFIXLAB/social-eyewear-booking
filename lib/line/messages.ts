/**
 * LINE message builders (pure functions — unit tested).
 * Flex Messages with a plain-text altText fallback for notifications.
 */
import { SERVICE_LABEL } from "../booking/constants";
import { formatThaiDate } from "../booking/dates";
import type { ServiceType } from "../../types";

export interface LineBookingInfo {
  bookingCode: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string; // HH:MM
  username: string;
  serviceType: ServiceType;
}

const BRAND = "#174d34";

function row(label: string, value: string) {
  return {
    type: "box",
    layout: "baseline",
    spacing: "sm",
    contents: [
      { type: "text", text: label, color: "#8a8a8a", size: "sm", flex: 3 },
      { type: "text", text: value, color: "#222222", size: "sm", flex: 6, wrap: true },
    ],
  };
}

function card(title: string, intro: string, b: LineBookingInfo, footerNote: string, siteUrl?: string) {
  return {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: BRAND,
      paddingAll: "16px",
      contents: [
        { type: "text", text: "Social Eyewear", color: "#cfe6d8", size: "xs", weight: "bold" },
        { type: "text", text: title, color: "#ffffff", size: "lg", weight: "bold", margin: "sm" },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: intro, size: "sm", color: "#444444", wrap: true },
        { type: "separator", margin: "md" },
        row("Booking ID", b.bookingCode),
        row("ชื่อ", b.username),
        row("บริการ", SERVICE_LABEL[b.serviceType] ?? b.serviceType),
        row("วันที่", formatThaiDate(b.date)),
        row("เวลา", `${b.start}–${b.end} น.`),
        { type: "separator", margin: "md" },
        { type: "text", text: footerNote, size: "xs", color: "#8a8a8a", wrap: true },
      ],
    },
    ...(siteUrl
      ? {
          footer: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "button",
                style: "secondary",
                height: "sm",
                action: { type: "uri", label: "จองคิวเพิ่ม", uri: siteUrl },
              },
            ],
          },
        }
      : {}),
  };
}

export function bookingConfirmedMessage(b: LineBookingInfo, siteUrl?: string) {
  const alt = `จองคิวสำเร็จ ${b.bookingCode} · ${formatThaiDate(b.date, { weekday: false })} ${b.start}–${b.end} น.`;
  return {
    type: "flex",
    altText: alt,
    contents: card(
      "จองคิวสำเร็จ ✓",
      `ขอบคุณคุณ${b.username} ที่จองคิวกับ Social Eyewear ค่ะ`,
      b,
      "หากต้องการเลื่อนหรือยกเลิกนัด พิมพ์แจ้งในแชทนี้ได้เลยค่ะ",
      siteUrl,
    ),
  };
}

export function bookingReminderMessage(b: LineBookingInfo) {
  const alt = `เตือนนัดพรุ่งนี้ ${b.start}–${b.end} น. · Social Eyewear`;
  return {
    type: "flex",
    altText: alt,
    contents: card(
      "เตือนนัดพรุ่งนี้ 🔔",
      `คุณ${b.username} มีนัดกับ Social Eyewear พรุ่งนี้ค่ะ`,
      b,
      "หากไม่สะดวกมาตามนัด รบกวนพิมพ์แจ้งในแชทนี้ค่ะ",
    ),
  };
}

export function bookingCancelledMessage(b: LineBookingInfo) {
  return {
    type: "text",
    text:
      `แจ้งยกเลิกนัด ${b.bookingCode}\n` +
      `${formatThaiDate(b.date)} เวลา ${b.start}–${b.end} น.\n` +
      `หากต้องการจองใหม่ กดปุ่ม "จองคิว" ที่เมนูด้านล่างได้เลยค่ะ`,
  };
}

export function bookingChangedMessage(b: LineBookingInfo) {
  return {
    type: "flex",
    altText: `เปลี่ยนเวลานัด ${b.bookingCode} → ${formatThaiDate(b.date, { weekday: false })} ${b.start} น.`,
    contents: card("เปลี่ยนเวลานัดแล้ว", `ร้านได้เปลี่ยนวัน/เวลานัดของคุณ${b.username} เป็นดังนี้ค่ะ`, b, "หากเวลาใหม่ไม่สะดวก พิมพ์แจ้งในแชทนี้ได้เลยค่ะ"),
  };
}
