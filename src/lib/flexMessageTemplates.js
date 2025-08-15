// src/lib/flexMessageTemplates.js

/**
 * สร้าง Flex Message สำหรับแจ้งเตือนเมื่อเช็คอินสำเร็จ
 * @param {object} data - ข้อมูลสำหรับแสดงผล
 * @param {string} data.activityName - ชื่อกิจกรรม
 * @param {string} data.fullName - ชื่อเต็มของนักเรียน
 * @param {string} data.seatNumber - เลขที่นั่ง
 * @returns {object} - JSON Object ของ Flex Message
 */
export const createCheckInSuccessFlex = ({ activityName, fullName, seatNumber }) => ({
  type: "bubble",
  header: {
    type: "box",
    layout: "vertical",
    backgroundColor: "#1E3A8A",
    contents: [
      { type: "text", text: "CHECK-IN SUCCESSFUL", color: "#FFFFFF", weight: "bold", size: "lg", align: "center" }
    ]
  },
  body: {
    type: "box",
    layout: "vertical",
    spacing: "md",
    contents: [
      { type: "text", text: "เช็คอินกิจกรรมสำเร็จ!", weight: "bold", size: "xl", align: "center", wrap: true },
      { type: "separator", margin: "lg" },
      {
        type: "box",
        layout: "vertical",
        margin: "lg",
        spacing: "sm",
        contents: [
          { type: "box", layout: "baseline", contents: [ { type: "text", text: "กิจกรรม", color: "#aaaaaa", size: "sm", flex: 3 }, { type: "text", text: activityName, wrap: true, color: "#666666", size: "sm", flex: 5 } ] },
          { type: "box", layout: "baseline", contents: [ { type: "text", text: "ชื่อ", color: "#aaaaaa", size: "sm", flex: 3 }, { type: "text", text: fullName, wrap: true, color: "#666666", size: "sm", flex: 5 } ] },
          { type: "box", layout: "baseline", contents: [ { type: "text", text: "ที่นั่ง", color: "#aaaaaa", size: "sm", flex: 3 }, { type: "text", text: seatNumber, wrap: true, color: "#111111", size: "lg", weight: "bold", flex: 5 } ] }
        ]
      }
    ]
  }
});

/**
 * สร้าง Flex Message สำหรับแจ้งเตือนเมื่อลงทะเบียนสำเร็จ
 * @param {object} data - ข้อมูลสำหรับแสดงผล
 * @param {string} data.activityName - ชื่อกิจกรรม
 * @param {string} data.fullName - ชื่อเต็มของนักเรียน
 * @returns {object} - JSON Object ของ Flex Message
 */
export const createRegistrationSuccessFlex = ({ activityName, fullName }) => ({
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#22C55E",
      contents: [
        { type: "text", text: "REGISTERED", color: "#FFFFFF", weight: "bold", size: "lg", align: "center" }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: "ลงทะเบียนสำเร็จ!", weight: "bold", size: "xl", align: "center", wrap: true },
        { type: "text", text: "คุณได้ลงทะเบียนเข้าร่วมกิจกรรมเรียบร้อยแล้ว", align: "center", wrap: true, size: "sm", color: "#666666" },
        { type: "separator", margin: "lg" },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "sm",
          contents: [
            { type: "box", layout: "baseline", contents: [ { type: "text", text: "กิจกรรม", color: "#aaaaaa", size: "sm", flex: 3 }, { type: "text", text: activityName || '', wrap: true, color: "#666666", size: "sm", flex: 5 } ] },
            { type: "box", layout: "baseline", contents: [ { type: "text", text: "ชื่อ", color: "#aaaaaa", size: "sm", flex: 3 }, { type: "text", text: fullName, wrap: true, color: "#666666", size: "sm", flex: 5 } ] }
          ]
        }
      ]
    },
    footer: {
        type: "box",
        layout: "vertical",
        contents: [
            {
                type: "button",
                action: { type: "uri", label: "ดูการลงทะเบียนทั้งหมด", uri: `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}/student/my-registrations` },
                style: "primary",
                color: "#1E40AF"
            }
        ]
    }
});