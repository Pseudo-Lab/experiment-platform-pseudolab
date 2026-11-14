import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { ProjectProvider, useProject } from '@/contexts/ProjectContext';
import { projectApi, type Project } from '@/services/api';

const STORAGE_KEY = 'currentProjectId';

const makeProject = (id: string, name = id): Project => ({
  id,
  name,
  project_type: 'ab_test',
  created_at: '2026-11-15T00:00:00Z',
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type ContextSnapshot = ReturnType<typeof useProject>;

function mountProvider(options?: { strictMode?: boolean; providerKey?: string }) {
  let latest!: ContextSnapshot;
  function Probe() {
    const ctx = useProject();
    latest = ctx;
    return (
      <output data-testid="state">
        {JSON.stringify({
          loading: ctx.loading,
          error: ctx.error,
          currentProjectId: ctx.currentProjectId,
          currentProject: ctx.currentProject,
          projects: ctx.projects,
        })}
      </output>
    );
  }

  const wrap = (key?: string) => {
    const provider = (
      <ProjectProvider key={key}>
        <Probe />
      </ProjectProvider>
    );
    return options?.strictMode ? <React.StrictMode>{provider}</React.StrictMode> : provider;
  };

  const view = render(wrap(options?.providerKey));
  return {
    getCtx: () => latest,
    rerenderWithKey: (key: string) => view.rerender(wrap(key)),
    unmount: view.unmount,
  };
}

describe('ProjectContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('exposes safe defaults including error:false outside ProjectProvider', () => {
    let outside!: ContextSnapshot;
    function OutsideProbe() {
      outside = useProject();
      return null;
    }
    render(<OutsideProbe />);
    expect(outside.projects).toEqual([]);
    expect(outside.loading).toBe(false);
    expect(outside.error).toBe(false);
    expect(outside.currentProjectId).toBeNull();
    expect(outside.currentProject).toBeNull();
  });

  it('loads projects without selecting projects[0] when no selection is remembered', async () => {
    const req = deferred<Project[]>();
    vi.spyOn(projectApi, 'list').mockReturnValueOnce(req.promise);

    const { getCtx } = mountProvider();
    expect(getCtx().loading).toBe(true);
    expect(getCtx().error).toBe(false);
    expect(getCtx().currentProjectId).toBeNull();
    expect(getCtx().currentProject).toBeNull();
    expect(getCtx().projects).toEqual([]);

    const alpha = makeProject('alpha', 'Alpha');
    const beta = makeProject('beta', 'Beta');
    await act(async () => {
      req.resolve([alpha, beta]);
    });

    expect(getCtx().loading).toBe(false);
    expect(getCtx().error).toBe(false);
    expect(getCtx().projects).toEqual([alpha, beta]);
    expect(getCtx().currentProjectId).toBeNull();
    expect(getCtx().currentProject).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('preserves a valid remembered selection across initial load', async () => {
    localStorage.setItem(STORAGE_KEY, 'beta');
    const req = deferred<Project[]>();
    vi.spyOn(projectApi, 'list').mockReturnValueOnce(req.promise);

    const { getCtx } = mountProvider();
    expect(getCtx().loading).toBe(true);
    expect(getCtx().error).toBe(false);
    expect(getCtx().currentProjectId).toBe('beta');
    expect(getCtx().currentProject).toBeNull();

    const alpha = makeProject('alpha', 'Alpha');
    const beta = makeProject('beta', 'Beta');
    await act(async () => {
      req.resolve([alpha, beta]);
    });

    expect(getCtx().loading).toBe(false);
    expect(getCtx().error).toBe(false);
    expect(getCtx().currentProjectId).toBe('beta');
    expect(getCtx().currentProject).toEqual(beta);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('beta');
  });

  it('clears in-memory selection and persisted storage when remembered selection is absent or removed', async () => {
    localStorage.setItem(STORAGE_KEY, 'missing');
    const alpha = makeProject('alpha', 'Alpha');
    const beta = makeProject('beta', 'Beta');
    vi.spyOn(projectApi, 'list')
      .mockResolvedValueOnce([alpha, beta])
      .mockResolvedValueOnce([beta]);

    const { getCtx } = mountProvider();
    await waitFor(() => expect(getCtx().loading).toBe(false));

    expect(getCtx().projects).toEqual([alpha, beta]);
    expect(getCtx().currentProjectId).toBeNull();
    expect(getCtx().currentProject).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    // Select a valid project, then reload after it has been deleted/revoked.
    act(() => {
      getCtx().setCurrentProjectId('alpha');
    });
    expect(getCtx().currentProjectId).toBe('alpha');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('alpha');

    await act(async () => {
      await getCtx().reloadProjects();
    });

    expect(getCtx().projects).toEqual([beta]);
    expect(getCtx().currentProjectId).toBeNull();
    expect(getCtx().currentProject).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('clears remembered selection and storage when server returns zero projects', async () => {
    localStorage.setItem(STORAGE_KEY, 'alpha');
    vi.spyOn(projectApi, 'list').mockResolvedValueOnce([]);

    const { getCtx } = mountProvider();
    await waitFor(() => expect(getCtx().loading).toBe(false));

    expect(getCtx().error).toBe(false);
    expect(getCtx().projects).toEqual([]);
    expect(getCtx().currentProjectId).toBeNull();
    expect(getCtx().currentProject).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('persists selection changes and keeps setter usable immediately after await reloadProjects', async () => {
    const alpha = makeProject('alpha', 'Alpha');
    const invited = makeProject('invited', 'Invited');
    vi.spyOn(projectApi, 'list')
      .mockResolvedValueOnce([alpha])
      .mockResolvedValueOnce([alpha, invited]);

    const { getCtx } = mountProvider();
    await waitFor(() => expect(getCtx().loading).toBe(false));

    act(() => {
      getCtx().setCurrentProjectId('alpha');
    });
    expect(getCtx().currentProjectId).toBe('alpha');
    expect(getCtx().currentProject).toEqual(alpha);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('alpha');

    act(() => {
      getCtx().setCurrentProjectId(null);
    });
    expect(getCtx().currentProjectId).toBeNull();
    expect(getCtx().currentProject).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    act(() => {
      getCtx().setCurrentProjectId('');
    });
    expect(getCtx().currentProjectId).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    // Capture callbacks from the pre-reload render (where `projects` only has `alpha`)
    // and select `invited` synchronously after `await reloadProjects()` before re-render.
    const { reloadProjects, setCurrentProjectId } = getCtx();
    await act(async () => {
      await reloadProjects();
      setCurrentProjectId('invited');
    });

    expect(getCtx().currentProjectId).toBe('invited');
    expect(getCtx().currentProject).toEqual(invited);
    expect(getCtx().projects).toEqual([alpha, invited]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('invited');
  });

  it('sets error, clears stale visible projects, preserves remembered ID, and recovers on retry', async () => {
    localStorage.setItem(STORAGE_KEY, 'beta');
    const alpha = makeProject('alpha', 'Alpha');
    const beta = makeProject('beta', 'Beta');

    const first = deferred<Project[]>();
    const retry1 = deferred<Project[]>();
    const secondFail = deferred<Project[]>();
    const retry2 = deferred<Project[]>();

    vi.spyOn(projectApi, 'list')
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(retry1.promise)
      .mockReturnValueOnce(secondFail.promise)
      .mockReturnValueOnce(retry2.promise);

    const { getCtx } = mountProvider();
    await act(async () => {
      first.reject(new Error('network error'));
    });

    expect(getCtx().loading).toBe(false);
    expect(getCtx().error).toBe(true);
    expect(getCtx().projects).toEqual([]);
    expect(getCtx().currentProject).toBeNull();
    expect(getCtx().currentProjectId).toBe('beta');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('beta');

    // Retry while resolving: loading true, error cleared while pending.
    let retryPromise!: Promise<void>;
    act(() => {
      retryPromise = getCtx().reloadProjects();
    });
    expect(getCtx().loading).toBe(true);
    expect(getCtx().error).toBe(false);

    await act(async () => {
      retry1.resolve([alpha, beta]);
      await retryPromise;
    });

    expect(getCtx().loading).toBe(false);
    expect(getCtx().error).toBe(false);
    expect(getCtx().projects).toEqual([alpha, beta]);
    expect(getCtx().currentProjectId).toBe('beta');
    expect(getCtx().currentProject).toEqual(beta);

    // A later reload failure clears previously visible project objects to prevent stale contents,
    // while still keeping the remembered ID for retry.
    await act(async () => {
      const p = getCtx().reloadProjects();
      secondFail.reject(new Error('503'));
      await p;
    });

    expect(getCtx().loading).toBe(false);
    expect(getCtx().error).toBe(true);
    expect(getCtx().projects).toEqual([]);
    expect(getCtx().currentProject).toBeNull();
    expect(getCtx().currentProjectId).toBe('beta');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('beta');

    // If retry reveals the remembered project is now gone, clear state and storage.
    await act(async () => {
      const p = getCtx().reloadProjects();
      retry2.resolve([alpha]);
      await p;
    });

    expect(getCtx().loading).toBe(false);
    expect(getCtx().error).toBe(false);
    expect(getCtx().projects).toEqual([alpha]);
    expect(getCtx().currentProjectId).toBeNull();
    expect(getCtx().currentProject).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('ignores out-of-order reload responses so older responses never overwrite list, selection, or error state', async () => {
    const alpha = makeProject('alpha', 'Alpha');
    const beta = makeProject('beta', 'Beta');

    const req1 = deferred<Project[]>();
    const req2 = deferred<Project[]>();
    const req3 = deferred<Project[]>();
    const req4 = deferred<Project[]>();

    vi.spyOn(projectApi, 'list')
      .mockReturnValueOnce(req1.promise)
      .mockReturnValueOnce(req2.promise)
      .mockReturnValueOnce(req3.promise)
      .mockReturnValueOnce(req4.promise);

    const { getCtx } = mountProvider();

    // Start newer reload #2 while #1 is still in flight.
    let p2!: Promise<void>;
    act(() => {
      p2 = getCtx().reloadProjects();
    });

    // Resolve #2 first, then select `beta`.
    await act(async () => {
      req2.resolve([alpha, beta]);
      await p2;
      getCtx().setCurrentProjectId('beta');
    });

    expect(getCtx().loading).toBe(false);
    expect(getCtx().projects).toEqual([alpha, beta]);
    expect(getCtx().currentProjectId).toBe('beta');
    expect(getCtx().currentProject).toEqual(beta);

    // Late resolution of #1 without `beta` must NOT overwrite list or clear `beta`.
    await act(async () => {
      req1.resolve([alpha]);
    });

    expect(getCtx().loading).toBe(false);
    expect(getCtx().error).toBe(false);
    expect(getCtx().projects).toEqual([alpha, beta]);
    expect(getCtx().currentProjectId).toBe('beta');
    expect(getCtx().currentProject).toEqual(beta);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('beta');

    // Start #3 (slow) and #4 (fast): if #3 settles first, loading stays true until #4 settles,
    // and if #3 rejects after #4 succeeds, #3 does not overwrite #4's success.
    let p3!: Promise<void>;
    let p4!: Promise<void>;
    act(() => {
      p3 = getCtx().reloadProjects();
      p4 = getCtx().reloadProjects();
    });

    await act(async () => {
      req4.resolve([beta]);
      await p4;
    });
    expect(getCtx().loading).toBe(false);
    expect(getCtx().projects).toEqual([beta]);

    await act(async () => {
      req3.reject(new Error('stale failure'));
      await p3;
    });
    expect(getCtx().loading).toBe(false);
    expect(getCtx().error).toBe(false);
    expect(getCtx().projects).toEqual([beta]);
    expect(getCtx().currentProjectId).toBe('beta');
  });

  it('keeps loading true if an older overlapping reload finishes before the newest reload', async () => {
    const alpha = makeProject('alpha', 'Alpha');
    const beta = makeProject('beta', 'Beta');

    const req1 = deferred<Project[]>();
    const req2 = deferred<Project[]>();
    vi.spyOn(projectApi, 'list')
      .mockReturnValueOnce(req1.promise)
      .mockReturnValueOnce(req2.promise);

    const { getCtx } = mountProvider();
    let p2!: Promise<void>;
    act(() => {
      p2 = getCtx().reloadProjects();
    });

    await act(async () => {
      req1.resolve([alpha]);
    });

    expect(getCtx().loading).toBe(true);
    expect(getCtx().projects).toEqual([]);

    await act(async () => {
      req2.resolve([alpha, beta]);
      await p2;
    });

    expect(getCtx().loading).toBe(false);
    expect(getCtx().projects).toEqual([alpha, beta]);
  });

  it('ignores in-flight reloads and setter calls after unmount', async () => {
    localStorage.setItem(STORAGE_KEY, 'alpha');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const req = deferred<Project[]>();
    const listSpy = vi.spyOn(projectApi, 'list').mockReturnValueOnce(req.promise);

    const { getCtx, unmount } = mountProvider();
    const { setCurrentProjectId, reloadProjects } = getCtx();

    unmount();

    await act(async () => {
      req.resolve([]);
    });

    // Late response after unmount must not clear storage or warn.
    expect(localStorage.getItem(STORAGE_KEY)).toBe('alpha');

    // Stale callbacks after unmount must be safe no-ops.
    act(() => {
      setCurrentProjectId('beta');
    });
    await act(async () => {
      await reloadProjects();
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe('alpha');
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('handles React StrictMode double-effect mount and account key remounts cleanly', async () => {
    localStorage.setItem(STORAGE_KEY, 'beta');
    const alpha = makeProject('alpha', 'Alpha');
    const beta = makeProject('beta', 'Beta');

    const reqStrict1 = deferred<Project[]>();
    const reqStrict2 = deferred<Project[]>();
    vi.spyOn(projectApi, 'list')
      .mockReturnValueOnce(reqStrict1.promise)
      .mockReturnValueOnce(reqStrict2.promise);

    const { getCtx } = mountProvider({ strictMode: true });
    await act(async () => {
      reqStrict2.resolve([alpha, beta]);
      reqStrict1.resolve([]);
    });

    expect(getCtx().loading).toBe(false);
    expect(getCtx().error).toBe(false);
    expect(getCtx().projects).toEqual([alpha, beta]);
    expect(getCtx().currentProjectId).toBe('beta');
    expect(getCtx().currentProject).toEqual(beta);
    cleanup();

    // Also verify StrictMode when the first pass settles/rejects BEFORE the second pass resolves.
    const reqStrictFailFirst = deferred<Project[]>();
    const reqStrictPassSecond = deferred<Project[]>();
    vi.spyOn(projectApi, 'list')
      .mockReturnValueOnce(reqStrictFailFirst.promise)
      .mockReturnValueOnce(reqStrictPassSecond.promise);

    const strictSecond = mountProvider({ strictMode: true });
    await act(async () => {
      reqStrictFailFirst.reject(new Error('aborted first pass'));
    });

    expect(strictSecond.getCtx().loading).toBe(true);
    expect(strictSecond.getCtx().error).toBe(false);

    await act(async () => {
      reqStrictPassSecond.resolve([alpha, beta]);
    });

    expect(strictSecond.getCtx().loading).toBe(false);
    expect(strictSecond.getCtx().error).toBe(false);
    expect(strictSecond.getCtx().projects).toEqual([alpha, beta]);
    expect(strictSecond.getCtx().currentProjectId).toBe('beta');
    expect(strictSecond.getCtx().currentProject).toEqual(beta);
    cleanup();

    // Account switch remount (keyed per auth account): prior account's slow reload
    // must not leak into the newly mounted account provider or overwrite storage.
    localStorage.setItem(STORAGE_KEY, 'proj-a');
    const projA = makeProject('proj-a', 'Project A');
    const projB = makeProject('proj-b', 'Project B');
    const reqAccountA = deferred<Project[]>();
    const reqAccountB = deferred<Project[]>();
    vi.spyOn(projectApi, 'list')
      .mockReturnValueOnce(reqAccountA.promise)
      .mockReturnValueOnce(reqAccountB.promise);

    const mounted = mountProvider({ providerKey: 'user-a' });
    mounted.rerenderWithKey('user-b');

    await act(async () => {
      reqAccountB.resolve([projB]);
    });

    expect(mounted.getCtx().projects).toEqual([projB]);
    expect(mounted.getCtx().currentProjectId).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    await act(async () => {
      reqAccountA.resolve([projA]);
    });

    expect(mounted.getCtx().projects).toEqual([projB]);
    expect(mounted.getCtx().currentProjectId).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
