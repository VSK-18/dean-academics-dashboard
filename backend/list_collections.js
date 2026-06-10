const mongoose = require('mongoose');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/dean_acad';

mongoose.connect(MONGO_URI)
    .then(async () => {
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));
        for (const col of collections) {
            const count = await mongoose.connection.db.collection(col.name).countDocuments({});
            console.log(`Collection ${col.name} has ${count} documents.`);
            if (count > 0) {
                const docs = await mongoose.connection.db.collection(col.name).find({}).toArray();
                console.log(docs);
            }
        }
        await mongoose.connection.close();
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
