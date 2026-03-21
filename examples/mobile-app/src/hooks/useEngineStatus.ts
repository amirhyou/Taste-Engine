import { useState, useEffect } from 'react';
import { EngineStatus } from '@taste-engine/core';
import { engineManager } from '../services/engineManager';

export function useEngineStatus() {
    const [status, setStatus] = useState<EngineStatus | null>(null);

    const updateStatus = () => {
        try {
            const engine = engineManager.getEngine();
            setStatus(engine.status());
        } catch {
            setStatus(null);
        }
    };

    useEffect(() => {
        updateStatus();
        // Subscribing to updates would be better if Engine supported events, 
        // for now we manual-trigger after each vote.
    }, []);

    const stabilityScore = status ? Math.floor(status.stability * 100) : 0;

    let label = "Initializing...";
    if (stabilityScore > 0) label = "Ranking your tracks...";
    if (stabilityScore >= 50) label = "Getting a sense of your taste...";
    if (stabilityScore >= 80) label = "Almost there!";
    if (stabilityScore >= 90 || status?.canStop) label = "Stable! Ready to export.";

    return {
        status,
        stabilityScore,
        label,
        refresh: updateStatus,
    };
}
