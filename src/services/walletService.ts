import { WalletState } from '../types';

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

  constructor() {
    // Check if previously connected in localStorage
    const saved = localStorage.getItem('pinn_connected_wallet');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.address) {
          this.state = parsed;
        }
      } catch {
        // ignore
      }
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
    if (this.state.isConnected && this.state.address) {
      localStorage.setItem('pinn_connected_wallet', JSON.stringify(this.state));
    } else {
      localStorage.removeItem('pinn_connected_wallet');
    }
  }

  public getState(): WalletState {
    return this.state;
  }

  public hasExtension(): boolean {
    return typeof window !== 'undefined' && Boolean(window.solana || window.phantom?.solana);
  }

  public async connect(walletType: 'phantom' | 'solflare' | 'demo' = 'phantom'): Promise<WalletState> {
    const solanaProvider = window.solana || window.phantom?.solana;

    if (walletType !== 'demo' && solanaProvider) {
      try {
        const res = await solanaProvider.connect();
        const pubKey = res.publicKey.toString();
        this.state = {
          isConnected: true,
          address: pubKey,
          walletName: solanaProvider.isPhantom ? 'Phantom' : 'Solana Wallet',
        };
        this.notify();
        return this.state;
      } catch (err) {
        console.warn('User rejected or wallet connection error:', err);
        throw err;
      }
    }

    // If no extension or demo mode selected, provide a clean demo wallet session for testing
    // with a real-format Solana public key
    const demoAddresses = [
      '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLyNzkKqV4F2E',
      '8mKbTqN2b1X9VfZ4p6Ww89Y5C1jL2mPnX3vQ4R7dJ8sT'
    ];
    const chosen = demoAddresses[Math.floor(Math.random() * demoAddresses.length)];

    this.state = {
      isConnected: true,
      address: chosen,
      walletName: 'Demo Solana Wallet',
    };
    this.notify();
    return this.state;
  }

  public async disconnect(): Promise<void> {
    const solanaProvider = window.solana || window.phantom?.solana;
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
  }
}

export const walletService = new WalletService();
