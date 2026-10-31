import { ArrowLeft, Printer } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { scopeDB } from '../../data/access';
import { docStatus } from '../../data/metrics';
import { docTotals, lineTotals } from '../../data/seed';
import { useDB } from '../../data/store';
import { money, shortDate } from '../../lib/format';

/**
 * Print-ready A4 document. "Download PDF" opens this view and the browser's
 * Save as PDF writes the file (named after the document number via the title).
 * Phase 4 replaces this with server-rendered PDFs served from signed URLs.
 */
export function InvoicePrint() {
  const { id } = useParams();
  const d = scopeDB(useDB());
  const doc = d.docs.find((x) => x.id === id);

  const number = doc?.number;
  useEffect(() => {
    if (!number) return;
    document.title = number;
    const t = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(t);
  }, [number]);

  if (!doc) {
    return (
      <div className="empty" style={{ paddingTop: 80 }}>
        <b>Document not found</b>
        It may have been deleted, or you don't have access to it.
      </div>
    );
  }
  const c = d.company;
  const account = d.accounts.find((a) => a.id === doc.accountId);
  const contact = d.contacts.find((x) => x.id === doc.contactId);
  const t = docTotals(doc);
  const status = docStatus(doc);
  const isInv = doc.kind === 'invoice';
  const fmt = (v: number) => money(v, doc.currency, { cents: true });
  // Group tax by rate; for INR with a GSTIN, split into CGST + SGST (intra-state default).
  const byRate = new Map<number, number>();
  for (const l of doc.lines) if (l.taxPct) byRate.set(l.taxPct, (byRate.get(l.taxPct) ?? 0) + lineTotals(l).tax);
  const gst = doc.currency === 'INR' && /GSTIN/i.test(c.taxId);

  return (
    <div style={{ padding: '24px 16px 60px', background: '#e9edf0', minHeight: '100vh' }}>
      <div className="no-print row between" style={{ maxWidth: 820, margin: '0 auto 16px' }}>
        <Link to={`/finance/${doc.id}`} className="btn">
          <ArrowLeft size={15} /> Back to Nexora
        </Link>
        <span className="muted" style={{ fontSize: 13 }}>
          Choose "Save as PDF" in the print dialog to download.
        </span>
        <button className="btn primary" onClick={() => window.print()}>
          <Printer size={15} /> Print / Save PDF
        </button>
      </div>
      <article className="doc">
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 36 }}>
          <div>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: '#15191d', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 20, marginBottom: 12 }}>{c.name[0]}</div>
            <b style={{ fontSize: 15 }}>{c.legalName}</b>
            <div style={{ whiteSpace: 'pre-line', color: '#555b62', marginTop: 4 }}>{c.address}</div>
            <div style={{ color: '#555b62', marginTop: 4 }}>{c.taxId}</div>
            <div style={{ color: '#555b62' }}>
              {c.email} · {c.phone}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>{isInv ? (gst ? 'TAX INVOICE' : 'INVOICE') : 'QUOTATION'}</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{doc.number}</div>
            <table style={{ marginTop: 14, width: 'auto', marginLeft: 'auto' }}>
              <tbody>
                <tr>
                  <td style={{ border: 0, padding: '2px 12px 2px 0', color: '#6b7178' }}>Issue date</td>
                  <td style={{ border: 0, padding: 2, textAlign: 'right' }}>{shortDate(doc.issueDate)}</td>
                </tr>
                <tr>
                  <td style={{ border: 0, padding: '2px 12px 2px 0', color: '#6b7178' }}>{isInv ? 'Due date' : 'Valid until'}</td>
                  <td style={{ border: 0, padding: 2, textAlign: 'right' }}>{shortDate(doc.dueDate)}</td>
                </tr>
                <tr>
                  <td style={{ border: 0, padding: '2px 12px 2px 0', color: '#6b7178' }}>Status</td>
                  <td style={{ border: 0, padding: 2, textAlign: 'right', fontWeight: 700 }}>{status.toUpperCase()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </header>

        <section style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7178', marginBottom: 6 }}>Bill to</div>
          <b style={{ fontSize: 14 }}>{account?.name}</b>
          {contact && <div>Attn. {contact.name}, {contact.title}</div>}
          <div style={{ color: '#555b62' }}>
            {account?.city}, {account?.country}
          </div>
          {contact?.email && <div style={{ color: '#555b62' }}>{contact.email}</div>}
        </section>

        <table>
          <thead>
            <tr>
              <th style={{ width: 28 }}>#</th>
              <th>Description</th>
              <th className="r">Qty</th>
              <th className="r">Unit price</th>
              <th className="r">Disc.</th>
              <th className="r">Tax</th>
              <th className="r">Amount</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l, i) => (
              <tr key={l.id}>
                <td>{i + 1}</td>
                <td>{l.description}</td>
                <td className="r">{l.qty}</td>
                <td className="r">{fmt(l.unitPrice)}</td>
                <td className="r">{l.discountPct ? `${l.discountPct}%` : '—'}</td>
                <td className="r">{l.taxPct ? `${l.taxPct}%` : '—'}</td>
                <td className="r">{fmt(lineTotals(l).net)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <table style={{ width: 320 }}>
            <tbody>
              <SumRow label="Subtotal" value={fmt(t.subtotal)} />
              {t.discount > 0 && <SumRow label="Discount" value={`− ${fmt(t.discount)}`} />}
              {[...byRate.entries()].flatMap(([rate, tax]) =>
                gst
                  ? [<SumRow key={`c${rate}`} label={`CGST @ ${rate / 2}%`} value={fmt(tax / 2)} />, <SumRow key={`s${rate}`} label={`SGST @ ${rate / 2}%`} value={fmt(tax / 2)} />]
                  : [<SumRow key={rate} label={`Tax @ ${rate}%`} value={fmt(tax)} />],
              )}
              <tr>
                <td style={{ borderBottom: 0, borderTop: '1.5px solid #14171a', fontWeight: 800, fontSize: 15 }}>Total ({doc.currency})</td>
                <td className="r" style={{ borderBottom: 0, borderTop: '1.5px solid #14171a', fontWeight: 800, fontSize: 15 }}>
                  {fmt(t.total)}
                </td>
              </tr>
              {isInv && t.paid > 0 && <SumRow label="Paid" value={`− ${fmt(t.paid)}`} />}
              {isInv && <SumRow label={<b>Balance due</b>} value={<b>{fmt(t.balance)}</b>} />}
            </tbody>
          </table>
        </div>

        <footer style={{ marginTop: 40, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, color: '#3d4247' }}>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7178', marginBottom: 6 }}>Payment details</div>
            <div>{c.bankDetails}</div>
            <div style={{ marginTop: 10 }}>{doc.terms}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7178', marginBottom: 6 }}>Notes</div>
            <div>{doc.notes}</div>
            <div style={{ marginTop: 34, borderTop: '1px solid #c9ced3', paddingTop: 6, width: 200, fontSize: 12, color: '#6b7178' }}>Authorised signatory</div>
          </div>
        </footer>
      </article>
    </div>
  );
}

function SumRow({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <tr>
      <td style={{ borderBottom: 0, padding: '5px 6px', color: '#555b62' }}>{label}</td>
      <td className="r" style={{ borderBottom: 0, padding: '5px 6px' }}>
        {value}
      </td>
    </tr>
  );
}
