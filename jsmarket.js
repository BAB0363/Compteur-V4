// jsmarket.js - Bourse de l'Asphalte
export const market = {
    state: {
        values: {
            "Voitures": { current: 1.00, base: 1.00, min: 0.50, max: 2.00, trend: 0 },
            "Vélos": { current: 1.00, base: 1.00, min: 0.50, max: 2.00, trend: 0 },
            "Utilitaires": { current: 5.00, base: 5.00, min: 2.50, max: 10.00, trend: 0 },
            "Motos": { current: 5.00, base: 5.00, min: 2.50, max: 10.00, trend: 0 },
            "Camions": { current: 20.00, base: 20.00, min: 10.00, max: 40.00, trend: 0 },
            "Camping-cars": { current: 50.00, base: 50.00, min: 25.00, max: 100.00, trend: 0 },
            "Bus/Car": { current: 50.00, base: 50.00, min: 25.00, max: 100.00, trend: 0 },
            "Engins agricoles": { current: 200.00, base: 200.00, min: 100.00, max: 400.00, trend: 0 }
        },
        lastUpdate: Date.now()
    },

    init() {
        this.loadState();
        // Le marché fluctue tout seul toutes les 5 minutes (300000 ms)
        setInterval(() => this.fluctuateMarket(), 300000);
    },

    loadState() {
        let saved = localStorage.getItem('market_state');
        if (saved) {
            try { this.state = { ...this.state, ...JSON.parse(saved) }; }
            catch(e) { console.error("Erreur chargement marché"); }
        }
    },

    saveState() {
        localStorage.setItem('market_state', JSON.stringify(this.state));
    },

    getValue(type) {
        if (type === "Poids Lourds") type = "Camions";
        return this.state.values[type] ? parseFloat(this.state.values[type].current.toFixed(2)) : 1.00;
    },
 

        // Appelé à chaque clic : fait chuter le prix du véhicule compté, et monter la rareté des autres
    recordDemand(type) {
        if (type === "Poids Lourds") type = "Camions";
        if (!this.state.values[type]) return;

        let item = this.state.values[type];
        item.current = Math.max(item.min, item.current * 0.98); 
        item.trend = -1; // 🔴 Tendance à la baisse
        
        Object.keys(this.state.values).forEach(k => {
            if (k !== type) {
                let other = this.state.values[k];
                other.current = Math.min(other.max, other.current * 1.005);
                other.trend = 1; // 🟢 Tendance à la hausse
            }
        });
        this.saveState();
    },

    fluctuateMarket() {
        Object.keys(this.state.values).forEach(k => {
            let item = this.state.values[k];
            let randomVariation = 1 + ((Math.random() - 0.5) * 0.1); 
            let newValue = Math.min(item.max, Math.max(item.min, item.current * randomVariation));
            
            // Détermine la tendance naturelle
            item.trend = newValue > item.current ? 1 : (newValue < item.current ? -1 : 0);
            item.current = newValue;
        });
        this.saveState();
        if(window.ui) window.ui.showToast("📈 Fluctuation de la Bourse de l'Asphalte !");
    }

};

window.market = market;
