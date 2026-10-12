import { Link } from 'react-router-dom';
import { CheckCircle2, Circle } from 'lucide-react';
import { PageHeader, LevelBadge, ProgressBar, Loading } from '../components/ui';
import { useT, pick } from '../lib/i18n';
import { useStore } from '../lib/storage';
import { availableLevels, loadLessons, useAsync } from '../lib/data';
import type { Lesson } from '../types';

const LEVEL_INFO: Record<string, { en: string; zh: string }> = {
  A1: { en: 'Absolute beginner — sounds, greetings and the basics', zh: '零基础 —— 发音、问候与基础语法' },
  A2: { en: 'Elementary — past and future, everyday situations', zh: '初级 —— 过去时与将来时、日常情景' },
  B1: { en: 'Intermediate — opinions, subjunctive, connectors', zh: '中级 —— 表达观点、虚拟式、连接词' },
  B2: { en: 'Upper-intermediate — argumentation for TCF (NCLC 7)', zh: '中高级 —— TCF 论证表达（NCLC 7）' },
  C1: { en: 'Advanced', zh: '高级' },
  C2: { en: 'Mastery', zh: '精通' },
};

export default function Learn() {
  const { t, lang } = useT();
  const levels = availableLevels('lessons');
  const all = useAsync(() => Promise.all(levels.map(loadLessons)), [levels.join()]);
  const [done] = useStore('lessons');

  return (
    <div>
      <PageHeader title={t('learn.title')} sub={t('learn.sub')} />
      {!all ? (
        <Loading />
      ) : levels.length === 0 ? (
        <p className="muted">{t('c.empty')}</p>
      ) : (
        levels.map((level, i) => {
          const list: Lesson[] = all[i] ?? [];
          const completed = list.filter((l) => done[l.id]).length;
          return (
            <section key={level} className="course-level">
              <div className="course-level-head">
                <h2>
                  <LevelBadge level={level} /> {lang === 'zh' ? LEVEL_INFO[level].zh : LEVEL_INFO[level].en}
                </h2>
                <span className="muted small">
                  {completed} / {list.length} {t('learn.lessons')}
                </span>
              </div>
              <ProgressBar value={completed} max={list.length} />
              <ol className="lesson-list">
                {list.map((l, n) => {
                  const rec = done[l.id];
                  return (
                    <li key={l.id}>
                      <Link to={`/learn/${l.id}`} className={`lesson-item card ${rec ? 'done' : ''}`}>
                        <span className="lesson-num">{n + 1}</span>
                        <div className="lesson-item-text">
                          <strong>{l.titleFr}</strong>
                          <span className="muted small">{pick(l, 'title', lang)}</span>
                        </div>
                        {rec ? (
                          <span className="lesson-score">
                            <CheckCircle2 size={18} /> {rec.score}/{rec.total}
                          </span>
                        ) : (
                          <Circle size={18} className="muted" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })
      )}
    </div>
  );
}
