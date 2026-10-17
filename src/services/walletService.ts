import { WalletState } from '../types';
import { playerAuthService } from './playerAuthService';

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      isSolflare?: boolean;
      connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>;
      disconnect: () => Promise<void>;
      publicKey?: { toString: () => string };
      isConnected?: boolean;
      on?: (event: string, callback: (args: unknown) => void) => void;
      signMessage?: (message: Uint8Array, encoding?: string) => Promise<{ signature: Uint8Array }>;
    };
    phantom?: {
      solana?: Window['solana'];
    };
  }
}

class WalletService {
  private state: WalletState = {
    isConnected: false,
    address: null,
    walletName: null,
  };

  private listeners: Array<(state: WalletState) => void> = [];
  private hasInitializedListeners = false;

  constructor() {
    // Check if previously connected in localStorage
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('pinn_connected_wallet');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.address) {
            this.state = parsed;
            // Background re-authentication if not already authenticated
            setTimeout(() => {
              if (this.state.address) {
                const isDemo = this.state.walletName?.toLowerCase().includes('demo') || false;
                playerAuthService.authenticateWallet(this.state.address, this.getProvider(), isDemo).catch((e) => {
                  console.warn('Initial session restore auth note:', e?.message || e);
                });
              }
            }, 100);
          }
        }
      } catch {
        // ignore
      }
    }

    if (typeof window !== 'undefined') {
      this.setupWalletEventListeners();
    }
  }

  private getProvider() {
    if (typeof window === 'undefined') return undefined;
    return window.solana || window.phantom?.solana;
  }

  private setupWalletEventListeners() {
    if (this.hasInitializedListeners) return;
    const provider = this.getProvider();
    if (provider && typeof provider.on === 'function') {
      this.hasInitializedListeners = true;

      // Listen for wallet account switching
      provider.on('accountChanged', (publicKey: unknown) => {
        if (publicKey) {
          const newAddress = typeof (publicKey as any).toString === 'function'
            ? (publicKey as any).toString()
            : String(publicKey);

          if (newAddress && newAddress !== this.state.address) {
            console.log('Solana wallet account changed to:', newAddress);
            this.state = {
              isConnected: true,
              address: newAddress,
              walletName: provider.isPhantom ? 'Phantom' : 'Solana Wallet',
            };
            this.notify();

            // Automatically re-authenticate new account and isolate data
            playerAuthService.authenticateWallet(newAddress, provider, false).catch((err) => {
              console.warn('Auto-authentication on account change note:', err);
            });
          }
        } else {
          // Empty public key means disconnected
          this.disconnect();
        }
      });

      // Listen for disconnect event
      provider.on('disconnect', () => {
        console.log('Solana wallet disconnected');
        this.disconnect();
      });
    }
  }

  public subscribe(listener: (state: WalletState) => void): () => void {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.state));
    if (typeof localStorage !== 'undefined') {
      if (this.state.isConnected && this.state.address) {
        localStorage.setItem('pinn_connected_wallet', JSON.stringify(this.state));
      } else {
        localStorage.removeItem('pinn_connected_wallet');
      }
    }
  }

  public getState(): WalletState {
    return this.state;
  }

  public hasExtension(): boolean {
    return typeof window !== 'undefined' && Boolean(window.solana || window.phantom?.solana);
  }

  public async connect(walletType: 'phantom' | 'solflare' = 'phantom'): Promise<WalletState> {
    const solanaProvider = this.getProvider();
    this.setupWalletEventListeners();

    if (solanaProvider) {
      try {
        const res = await solanaProvider.connect();
        const pubKey = res.publicKey.toString();
        this.state = {
          isConnected: true,
          address: pubKey,
          walletName: solanaProvider.isPhantom ? 'Phantom' : 'Solana Wallet',
        };
        this.notify();

        // 1. AUTOMATIC WALLET AUTHENTICATION & PROFILE SYNCHRONIZATION
        try {
          await playerAuthService.authenticateWallet(pubKey, solanaProvider);
        } catch (authErr) {
          console.warn('Wallet ownership authentication error:', authErr);
        }

        return this.state;
      } catch (err) {
        console.warn('User rejected or wallet connection error:', err);
        throw err;
      }
    }

    // If no provider detected in window
    throw new Error(
      `No supported Solana wallet extension detected (${walletType === 'phantom' ? 'Phantom' : 'Solflare'}). Please install the extension or open PINN Arcade inside your wallet app browser.`
    );
  }

  public async disconnect(): Promise<void> {
    const solanaProvider = this.getProvider();
    if (solanaProvider && solanaProvider.disconnect) {
      try {
        await solanaProvider.disconnect();
      } catch {
        // ignore
      }
    }
    this.state = {
      isConnected: false,
      address: null,
      walletName: null,
    };
    this.notify();

    // Clear player session and isolate data
    playerAuthService.clearSession();
  }
}

export const walletService = new WalletService();
