// jsml-worker.js
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js');

self.onmessage = async function(e) {
    const { type, features, labels, numClasses } = e.data;

    if (!features || features.length === 0) {
        self.postMessage({ success: false, type: type });
        return;
    }

    try {
        const xs = tf.tensor2d(features);
        const ys = tf.oneHot(tf.tensor1d(labels, 'int32'), numClasses);

        const model = tf.sequential();
        // Couche d'entrée passée à 10 neurones (pour le Rythme/Heure et Tendance 10m)
                model.add(tf.layers.dense({ units: 32, activation: 'relu', inputShape: [11] }));
        model.add(tf.layers.dense({ units: 24, activation: 'relu' }));
        model.add(tf.layers.dense({ units: numClasses, activation: 'softmax' }));

        model.compile({ optimizer: 'adam', loss: 'categoricalCrossentropy', metrics: ['accuracy'] });

                // ⚖️ Calcul du système anti-paresse de Gégé (Class Weights)
        let classCounts = {};
        labels.forEach(l => classCounts[l] = (classCounts[l] || 0) + 1);
        let classWeight = {};
        for (let i = 0; i < numClasses; i++) {
            // Plus le véhicule est rare, plus le poids de la correction est lourd !
            classWeight[i] = classCounts[i] ? (labels.length / (numClasses * classCounts[i])) : 1;
        }

        await model.fit(xs, ys, {
            epochs: 50,
            shuffle: true,
            classWeight: classWeight
        });


        await model.save(`indexeddb://model-${type}`);

        xs.dispose();
        ys.dispose();

        self.postMessage({ success: true, type: type });

    } catch (error) {
        console.error("Erreur dans le Worker TF:", error);
        self.postMessage({ success: false, type: type, error: error.message });
    }
};
