import { Link } from "react-router-dom";

const ManagementHero = ({
  eyebrow = "",
  title,
  description = "",
  meta = "",
  backTo = "",
  backLabel = "戻る",
  children = null,
  surface = true,
}) => {
  const wrapperClassName = surface
    ? "rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm sm:p-7"
    : "p-0";

  return (
    <section className={wrapperClassName}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">{eyebrow}</p>
          ) : null}
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
          {description ? <p className="mt-2 text-base text-slate-600">{description}</p> : null}
          {meta ? <p className="mt-2 text-sm text-slate-500">{meta}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {children}
          {backTo ? (
            <Link
              to={backTo}
              className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              {backLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default ManagementHero;
