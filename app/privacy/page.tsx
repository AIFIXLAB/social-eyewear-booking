import Link from "next/link";

export const metadata = { title: "นโยบายความเป็นส่วนตัว | Social Eyewear" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-neutral-800">
      <Link href="/" className="text-sm font-semibold text-brand-700">‹ กลับไปหน้าจองคิว</Link>
      <h1 className="mt-4 text-2xl font-bold">นโยบายความเป็นส่วนตัว (Privacy Notice)</h1>
      <p className="mt-1 text-sm text-neutral-500">ระบบจองคิวตรวจสายตา Social Eyewear · ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)</p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="mb-2 text-base font-semibold">1. ข้อมูลที่เราเก็บ</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>ชื่อผู้จอง และเบอร์โทรศัพท์</li>
            <li>ประเภทบริการและรายละเอียดเพิ่มเติมที่ท่านกรอก</li>
            <li>วันและเวลานัดหมาย</li>
            <li>กรณีจองผ่าน LINE: LINE User ID และชื่อที่แสดงใน LINE (Display Name) ซึ่งได้รับการยืนยันจาก LINE โดยตรง</li>
          </ul>
        </section>
        <section>
          <h2 className="mb-2 text-base font-semibold">2. วัตถุประสงค์การใช้ข้อมูล</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>เพื่อจัดคิวและให้บริการตามนัดหมาย</li>
            <li>เพื่อติดต่อยืนยัน เลื่อน หรือยกเลิกนัดหมาย</li>
            <li>เพื่อสรุปสถิติการให้บริการภายในร้าน (ไม่ระบุตัวบุคคล)</li>
          </ul>
          <p className="mt-2">ฐานทางกฎหมาย: การปฏิบัติตามคำขอของท่านก่อนเข้ารับบริการ และความยินยอมของท่าน</p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-semibold">3. การเปิดเผยและการจัดเก็บ</h2>
          <p>
            ข้อมูลเข้าถึงได้เฉพาะเจ้าหน้าที่ของร้านที่มีบัญชีผู้ดูแลระบบเท่านั้น ร้านไม่ขายหรือเปิดเผยข้อมูลแก่บุคคลภายนอก
            ข้อมูลถูกจัดเก็บบนบริการฐานข้อมูลคลาวด์ (Supabase) และส่งผ่านการเชื่อมต่อแบบเข้ารหัส (HTTPS)
            ลูกค้าท่านอื่นไม่สามารถเห็นชื่อหรือเบอร์โทรศัพท์ของท่านได้
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-semibold">4. ระยะเวลาการเก็บรักษา</h2>
          <p>ร้านเก็บข้อมูลการนัดหมายไว้ไม่เกิน 2 ปีนับจากวันนัดหมาย หรือตามที่กฎหมายกำหนด แล้วจะลบหรือทำให้ไม่สามารถระบุตัวบุคคลได้</p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-semibold">5. สิทธิของเจ้าของข้อมูล</h2>
          <p>
            ท่านมีสิทธิขอเข้าถึง ขอสำเนา ขอแก้ไข ขอลบ ขอระงับการใช้ คัดค้าน และถอนความยินยอมเกี่ยวกับข้อมูลของท่าน
            โดยติดต่อร้าน Social Eyewear ผ่าน LINE Official Account หรือที่หน้าร้าน การถอนความยินยอมอาจทำให้ร้านไม่สามารถให้บริการนัดหมายได้
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-semibold">6. ผู้ควบคุมข้อมูลส่วนบุคคล</h2>
          <p>ร้าน Social Eyewear (กรุณาเพิ่มที่อยู่และช่องทางติดต่อของร้านในส่วนนี้ก่อนเปิดใช้งานจริง)</p>
        </section>
      </div>
    </main>
  );
}
