// jsml-worker.js - Gégé 2.0 : Réseau de neurones spatial
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js');

self.onmessage = async function(e) {
    const { type, features, labels, numClasses } = e.data;
    if (!features || features.length === 0) return self.postMessage({ success: false });

    try {
        const xs = tf.tensor2d(features);
        const ys = tf.oneHot(tf.tensor1d(labels, 'int32'), numClasses);

        const model = tf.sequential();
        // Couche d'entrée (11 critères : Temps, GPS, Vitesse, Séquences...)
        model.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [11] }));
        model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
        model.add(tf.layers.dense({ units: numClasses, activation: 'softmax' }));

        model.compile({ optimizer: 'adam', loss: 'categoricalCrossentropy' });

        // On équilibre légèrement pour ne pas oublier les véhicules rares sans devenir fou
        let classCounts = {};
        labels.forEach(l => classCounts[l] = (classCounts[l] || 0) + 1);
        let classWeight = {};
        for (let i = 0; i < numClasses; i++) {
            let weight = classCounts[i] ? (labels.length / (numClasses * classCounts[i])) : 1;
            classWeight[i] = Math.min(2.5, Math.max(0.7, weight)); // Équilibrage doux
        }

        await model.fit(xs, ys, { epochs: 60, shuffle: true, classWeight: classWeight });
        await model.save(`indexeddb://model-${type}`);

        xs.dispose(); ys.dispose();
        self.postMessage({ success: true, type });
    } catch (error) {
        self.postMessage({ success: false, error: error.message });
    }
};
