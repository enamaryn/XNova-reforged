'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth-store';
import { getApiBaseUrl } from '../api/client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export function useSocket() {
  return useContext(SocketContext);
}

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Utiliser le hook Zustand pour s'abonner aux changements
  const tokens = useAuthStore((state) => state.tokens);
  const status = useAuthStore((state) => state.status);
  const isAuthenticated = status === 'authenticated' && !!tokens;
  const accessToken = tokens?.accessToken;

  // Attendre le côté client pour éviter les problèmes de SSR
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Ne rien faire côté serveur
    if (!isClient) return;

    // Créer la connexion WebSocket seulement si l'utilisateur est authentifié
    if (!isAuthenticated || !accessToken) {
      // Déconnecter le socket si l'utilisateur se déconnecte
      setSocket(null);
      setIsConnected(false);
      return;
    }

    // URL de l'API WebSocket
    const apiUrl = getApiBaseUrl();

    // Créer la connexion Socket.io
    const newSocket = io(`${apiUrl}/game`, {
      auth: {
        token: accessToken,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Événements de connexion
    newSocket.on('connect', () => {
      console.log('[WebSocket] Connected:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('connected', (data) => {
      console.log('[WebSocket] Server confirmed connection:', data);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error.message);
      setIsConnected(false);
    });

    // Événements de jeu (pour debug)
    newSocket.on('resources:updated', (data) => {
      console.log('[WebSocket] Resources updated:', data);
    });

    newSocket.on('building:completed', (data) => {
      console.log('[WebSocket] Building completed:', data);
    });

    newSocket.on('research:completed', (data) => {
      console.log('[WebSocket] Research completed:', data);
    });

    newSocket.on('fleet:arrived', (data) => {
      console.log('[WebSocket] Fleet arrived:', data);
    });

    setSocket(newSocket);

    // Cleanup lors du démontage
    return () => {
      console.log('[WebSocket] Cleaning up connection');
      newSocket.disconnect();
    };
  }, [isClient, isAuthenticated, accessToken]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}
