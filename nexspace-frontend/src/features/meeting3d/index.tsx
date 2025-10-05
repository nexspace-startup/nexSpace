import React, { Suspense } from 'react';

const SceneRoot = React.lazy(() => import('./SceneRoot'));

export type Meeting3DProps = {
  bottomSafeAreaPx?: number;
  topSafeAreaPx?: number;
};

const LoadingFallback: React.FC = () => (
  <div className="flex h-full w-full items-center justify-center bg-slate-950/80 text-slate-200">
    <div className="flex flex-col items-center gap-3">
      <span className="h-12 w-12 animate-spin rounded-full border-4 border-slate-500 border-t-slate-200" aria-hidden />
      <p className="text-sm font-medium tracking-wide">Preparing immersive workspace…</p>
    </div>
  </div>
);

const Meeting3DExperience: React.FC<Meeting3DProps> = (props) => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SceneRoot {...props} />
    </Suspense>
  );
};

export default Meeting3DExperience;
