import { useDeferredValue, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { FavButton, LevelBadge, Loading, PageHeader, SpeakButton } from '../components/ui';
import { useT } from '../lib/i18n';
import { loadAllVocab, normalize, useAsync } from '../lib/data';
import type { VocabItem } from '../types';

const levelOf = (v: VocabItem) => v.id.slice(0, 2).toUpperCase();
const headword = (fr: string) => fr.replace(/\s*\((m|f)\.\)/, '').replace(/^(le|la|les|l')\s*/i, '').split(',')[0].trim();

export default function Dictionary() {
  const { t, lang } = useT();
  const all = useAsync(loadAllVocab, []);
  const [q, setQ] = useState('');
  const query = useDeferredValue(q);

  const results = useMemo(() => {
    if (!all || !query.trim()) return [];
    const nq = normalize(query, false);
    const scored: [number, VocabItem][] = [];
    for (const v of all) {
      const fr = normalize(v.fr, false);
      const hw = normalize(headword(v.fr), false);
      let s = 0;
      if (hw === nq) s = 100;
      else if (hw.startsWith(nq)) s = 80;
      else if (fr.includes(nq)) s = 60;
      else if (normalize(v.en, false).split(/[,;/]\s*/).some((m) => m === nq || m === `to ${nq}`)) s = 70;
      else if (v.zh.split(/[，,；;、/]/).some((m) => m.trim() === query.trim())) s = 70;
      else if (normalize(v.en, false).includes(nq)) s = 40;
      else if (v.zh.includes(query.trim())) s = 40;
      else if (normalize(v.ex, false).includes(nq)) s = 10;
      if (s) scored.push([s, v]);
    }
    return scored.sort((a, b) => b[0] - a[0] || a[1].fr.length - b[1].fr.length).slice(0, 60).map(([, v]) => v);
  }, [all, query]);

  const word = encodeURIComponent(headword(q.trim()) || q.trim());

  return (
    <div>
      <PageHeader title={t('d.title')} sub={t('d.sub')} />
      <label className="search">
        <Search size={18} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('d.placeholder')} aria-label={t('d.title')} lang="fr" />
      </label>
      {!all ? (
        <Loading />
      ) : !q.trim() ? (
        <p className="muted small">
          {t('d.typeToSearch')} · {all.length} {lang === 'zh' ? '个词条' : 'entries'}
        </p>
      ) : (
        <>
          <p className="muted small">
            {results.length} {t('d.results')}
          </p>
          <div className="dict-results">
            {results.map((v) => (
              <div key={v.id} className="card dict-entry">
                <div className="dict-head">
                  <div>
                    <strong className="dict-word">{v.fr}</strong> <span className="muted small">{v.pos}</span> <SpeakButton text={v.fr.replace(/\s*\((m|f)\.\)/, '')} />
                  </div>
                  <div className="row">
                    <LevelBadge level={levelOf(v)} />
                    <FavButton id={v.id} />
                  </div>
                </div>
                <div>
                  {v.en} · {v.zh}
                </div>
                <div className="dict-ex">
                  <span>
                    {v.ex} <SpeakButton text={v.ex} />
                  </span>
                  <span className="muted small">{lang === 'zh' ? v.exZh : v.exEn}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="card external">
            <strong>{t('d.external')}:</strong>{' '}
            <a href={`https://www.wordreference.com/fren/${word}`} target="_blank" rel="noreferrer">
              WordReference
            </a>{' '}
            ·{' '}
            <a href={`https://www.larousse.fr/dictionnaires/francais/${word}`} target="_blank" rel="noreferrer">
              Larousse
            </a>{' '}
            ·{' '}
            <a href={`https://www.linguee.com/english-french/search?query=${word}`} target="_blank" rel="noreferrer">
              Linguee
            </a>{' '}
            ·{' '}
            <a href={`https://usito.usherbrooke.ca/définitions/${word}`} target="_blank" rel="noreferrer">
              Usito (Québec)
            </a>{' '}
            ·{' '}
            <a href={`https://www.frdic.com/dicts/fr/${word}`} target="_blank" rel="noreferrer">
              法语助手
            </a>
          </div>
        </>
      )}
    </div>
  );
}
