import { Engine, PairRecommendation } from '@taste-engine/core';
import { engineManager, ItemMetadata } from './engineManager';

export class SessionController {
    private engine: Engine | null = null;
    private activePair: PairRecommendation | null = null;
    private stagedPair: PairRecommendation | null = null;

    init() {
        this.engine = engineManager.getEngine();
        this.refreshPairs();
    }

    private refreshPairs() {
        if (!this.engine) return;
        if (!this.activePair) {
            this.activePair = this.engine.nextPair();
        }
        if (!this.stagedPair) {
            this.stagedPair = this.engine.nextPair();
        }
    }

    getActivePair(): PairRecommendation | null {
        if (!this.activePair && this.engine) this.refreshPairs();
        return this.activePair;
    }

    getStagedPair(): PairRecommendation | null {
        return this.stagedPair;
    }

    getMetadata(itemId: string): ItemMetadata {
        return engineManager.getMetadata(itemId);
    }

    async ingest(strength: number) {
        if (!this.activePair || !this.engine) return;

        const isDraw = Math.abs(strength) < 0.1;
        this.engine.ingest({
            a: this.activePair.a,
            b: this.activePair.b,
            result: isDraw ? 'tie' : (strength < 0 ? 'a' : 'b'),
            t: Date.now(),
        });

        // Auto-save via manager
        await engineManager.save();

        // Dual-Buffer Promotion:
        // Move staged to active, and pre-calculate the next stage
        this.activePair = this.stagedPair;
        this.stagedPair = this.engine.nextPair();

        // Safety if engine runs out of pairs 
        if (!this.activePair && this.stagedPair) {
            this.activePair = this.stagedPair;
            this.stagedPair = null;
        }
    }

    getStatusMessage(): string {
        if (!this.engine) return "Loading...";
        const stats = this.engine.status();
        const k = this.engine.snapshot().config.k;

        if (stats.canStop) {
            return `Ready! Your Top ${k} is locked in.`;
        }

        if (stats.stability > 80) {
            return "Almost there! Preferences are solidifying.";
        }

        if (stats.stability > 50) {
            return "Getting a good sense of your taste...";
        }

        return "Ranking tracks...";
    }

    getStability(): number {
        return this.engine ? Math.round(this.engine.status().stability) : 0;
    }

    canExport(): boolean {
        return this.engine ? this.engine.status().canStop : false;
    }
}

// Export singleton instance for UI usage
export const sessionController = new SessionController();
