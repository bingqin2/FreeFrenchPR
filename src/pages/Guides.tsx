import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ExternalLink, ShieldAlert } from 'lucide-react';
import Md, { Inline } from '../components/Md';
import { Loading, PageHeader } from '../components/ui';
import { useT, pick } from '../lib/i18n';
import { loadGuides, useAsync } from '../lib/data';

export default function Guides() {
  const { id } = useParams();
  const { t, lang } = useT();
  const guides = useAsync(loadGuides, []);
  if (!guides) return <Loading />;

  if (id) {
    const g = guides.find((x) => x.id === id);
    if (!g) return <p className="muted">{t('c.empty')}</p>;
    return (
      <article className="guide">
        <Link to="/guides" className="back-link">
          <ArrowLeft size={16} /> {t('g.title')}
        </Link>
        <h1>{pick(g, 'title', lang)}</h1>
        <p className="lead muted">{pick(g, 'summary', lang)}</p>
        <p className="small muted">
          {t('g.updated')}: {g.updated}
        </p>
        <nav className="toc card">
          <ol>
            {g.sections.map((s, i) => (
              <li key={i}>
                <a href={`#s${i}`} onClick={(e) => { e.preventDefault(); document.getElementById(`s${i}`)?.scrollIntoView({ behavior: 'smooth' }); }}>
                  {pick(s, 'heading', lang)}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        {g.sections.map((s, i) => (
          <section key={i} id={`s${i}`}>
            <h2>{pick(s, 'heading', lang)}</h2>
            <Md text={pick(s, 'body', lang)} />
            {s.table && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {s.table.headers.map((h, j) => (
                        <th key={j}>
                          <Inline text={h} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.table.rows.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, k) => (
                          <td key={k}>
                            <Inline text={c} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
        <section className="card sources">
          <h3>{t('g.sources')}</h3>
          <ul>
            {g.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.label} <ExternalLink size={12} />
                </a>
              </li>
            ))}
          </ul>
        </section>
        <p className="callout warn small">
          <ShieldAlert size={16} /> {t('g.disclaimer')}
        </p>
      </article>
    );
  }

  return (
    <div>
      <PageHeader title={t('g.title')} sub={t('g.sub')} />
      {guides.length === 0 && <p className="muted">{t('c.empty')}</p>}
      <div className="task-grid">
        {guides.map((g) => (
          <Link key={g.id} to={`/guides/${g.id}`} className="card task-card guide-card">
            <strong>{pick(g, 'title', lang)}</strong>
            <span className="muted small">{pick(g, 'summary', lang)}</span>
            <span className="small link-more">
              {lang === 'zh' ? '阅读' : 'Read'} <ArrowRight size={14} />
            </span>
          </Link>
        ))}
      </div>
      <p className="callout warn small">
        <ShieldAlert size={16} /> {t('g.disclaimer')}
      </p>
    </div>
  );
}
