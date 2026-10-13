import { useMemo } from 'react';
import type { Dependency, Task } from '../types';
import { pertEstimate, topoSort } from '../lib/scheduling';

const NODE_W = 168;
const NODE_H = 62;
const GAP_X = 90;
const GAP_Y = 26;

interface PertChartProps {
  tasks: Task[];
  dependencies: Dependency[];
  criticalPath: string[];
}

export function PertChart({ tasks, dependencies, criticalPath }: PertChartProps) {
  const layout = useMemo(() => {
    const order = topoSort(tasks, dependencies) ?? tasks.map((t) => t.id);
    const depth = new Map<string, number>();
    const preds = new Map<string, string[]>();
    for (const d of dependencies) {
      if (!preds.has(d.successorId)) preds.set(d.successorId, []);
      preds.get(d.successorId)!.push(d.predecessorId);
    }
    for (const id of order) {
      let d = 0;
      for (const p of preds.get(id) ?? []) {
        d = Math.max(d, (depth.get(p) ?? 0) + 1);
      }
      depth.set(id, d);
    }

    const columns = new Map<number, string[]>();
    for (const id of order) {
      const d = depth.get(id) ?? 0;
      if (!columns.has(d)) columns.set(d, []);
      columns.get(d)!.push(id);
    }

    const positions = new Map<string, { x: number; y: number }>();
    let maxRows = 0;
    for (const [d, ids] of columns) {
      maxRows = Math.max(maxRows, ids.length);
      ids.forEach((id, i) => {
        positions.set(id, {
          x: 30 + d * (NODE_W + GAP_X),
          y: 24 + i * (NODE_H + GAP_Y),
        });
      });
    }

    const width = (columns.size || 1) * (NODE_W + GAP_X) + 30;
    const height = maxRows * (NODE_H + GAP_Y) + 40;
    return { positions, width, height };
  }, [tasks, dependencies]);

  const criticalSet = useMemo(() => new Set(criticalPath), [criticalPath]);

  if (tasks.length === 0) {
    return <p className="muted">Tidak ada tugas untuk ditampilkan pada diagram PERT.</p>;
  }

  return (
    <div className="pert-scroll">
      <svg
        width={layout.width}
        height={layout.height}
        className="pert-svg"
        role="img"
        aria-label="Diagram jaringan PERT"
      >
        <defs>
          <marker
            id="pert-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
          </marker>
          <marker
            id="pert-arrow-critical"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
          </marker>
        </defs>

        {dependencies.map((dep) => {
          const from = layout.positions.get(dep.predecessorId);
          const to = layout.positions.get(dep.successorId);
          if (!from || !to) return null;
          const x1 = from.x + NODE_W;
          const y1 = from.y + NODE_H / 2;
          const x2 = to.x;
          const y2 = to.y + NODE_H / 2;
          const critical =
            criticalSet.has(dep.predecessorId) && criticalSet.has(dep.successorId);
          const cx = Math.max(30, (x2 - x1) / 2);
          const path = `M ${x1} ${y1} C ${x1 + cx} ${y1}, ${x2 - cx} ${y2}, ${x2} ${y2}`;
          return (
            <g key={dep.id}>
              <path
                d={path}
                fill="none"
                stroke={critical ? '#ef4444' : '#94a3b8'}
                strokeWidth={critical ? 2 : 1.3}
                markerEnd={critical ? 'url(#pert-arrow-critical)' : 'url(#pert-arrow)'}
              />
              <text
                x={(x1 + x2) / 2}
                y={(y1 + y2) / 2 - 6}
                className="pert-edge-label"
                textAnchor="middle"
              >
                {dep.type}
                {dep.lagDays ? `+${dep.lagDays}` : ''}
              </text>
            </g>
          );
        })}

        {[...layout.positions.entries()].map(([id, pos]) => {
          const task = tasks.find((t) => t.id === id);
          if (!task) return null;
          const est = pertEstimate(task);
          const critical = criticalSet.has(id);
          return (
            <g key={id} transform={`translate(${pos.x}, ${pos.y})`}>
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={10}
                className={`pert-node ${critical ? 'pert-node--critical' : ''}`}
              />
              <text x={12} y={20} className="pert-node__title">
                {task.name.length > 22 ? `${task.name.slice(0, 21)}…` : task.name}
              </text>
              <text x={12} y={37} className="pert-node__meta">
                TE = {est.expected.toFixed(2)} hari
              </text>
              <text x={12} y={52} className="pert-node__meta">
                σ² = {est.variance.toFixed(2)}
              </text>
              <rect
                width={6}
                height={NODE_H}
                rx={3}
                x={-3}
                fill={critical ? '#ef4444' : task.color}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
