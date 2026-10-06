import { useEffect, useState, useRef } from 'react';
import { useAuth } from './useAuth.js';
import { ConvexSocketBridge } from '../services/convexSocket.js';

export function useSocket() {
  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const bridgeRef = useRef<ConvexSocketBridge | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (bridgeRef.current) {
        bridgeRef.current.destroy();
        bridgeRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const bridge = new ConvexSocketBridge(user.id, user.displayName);
    bridgeRef.current = bridge;
    setIsConnected(true);

    return () => {
      bridge.destroy();
      bridgeRef.current = null;
      setIsConnected(false);
    };
  }, [user, isAuthenticated]);

  return {
    socket: bridgeRef.current as any,
    isConnected,
  };
}
