import { useState, useEffect, useRef } from 'react';
import { GetSystemResource } from '../../wailsjs/go/main/App';

interface SystemResource {
  cpuUsage: number;
  memoryUsage: number;
  memoryMB: number;
}

interface ResourceMonitorProps {
  enabled: boolean;
}

export default function ResourceMonitor({ enabled }: ResourceMonitorProps) {
  const [resource, setResource] = useState<SystemResource>({ cpuUsage: 0, memoryUsage: 0, memoryMB: 0 });
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const fetchResource = async () => {
      try {
        const res = await GetSystemResource();
        setResource(res);
      } catch (error) {
        console.error('Failed to fetch system resource:', error);
      }
    };

    fetchResource();
    intervalRef.current = window.setInterval(fetchResource, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="flex items-center gap-3 text-xs text-text-muted">
      <div className="flex items-center gap-1">
        <span className="font-semibold">CPU:</span>
        <span className={resource.cpuUsage > 80 ? 'text-level-error' : resource.cpuUsage > 50 ? 'text-level-warn' : 'text-level-info'}>
          {resource.cpuUsage.toFixed(1)}%
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span className="font-semibold">MEM:</span>
        <span className={resource.memoryMB > 500 ? 'text-level-error' : resource.memoryMB > 200 ? 'text-level-warn' : 'text-level-info'}>
          {resource.memoryMB.toFixed(1)} MB
        </span>
      </div>
    </div>
  );
}
