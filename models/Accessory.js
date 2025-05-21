import { ObjectId } from 'mongodb';

class Accessory {
    constructor(data) {
        this._id = data._id || new ObjectId();
        this.id = data.id;
        this.acc_id = data.acc_id;
        this.brand = data.brand;
        this.name = data.name;
        this.price = data.price;
        this.original_price = data.original_price;
        this.discount = data.discount;
        this.rating = data.rating;
        this.rating_count = data.rating_count;
        this.image_url = data.image_url;
        this.category = data.category;
        this.description = data.description;
        this.visual_cue = data.visual_cue;
    }

    static async findById(db, id) {
        const collection = db.collection('Accessories');
        const accessory = await collection.findOne({ _id: new ObjectId(id) });
        return accessory ? new Accessory(accessory) : null;
    }

    static async findAll(db, query = {}, options = {}) {
        const collection = db.collection('Accessories');
        return await collection.find(query, options).toArray();
    }

    async save(db) {
        const collection = db.collection('Accessories');
        if (this._id) {
            await collection.updateOne(
                { _id: this._id },
                { $set: this }
            );
        } else {
            const result = await collection.insertOne(this);
            this._id = result.insertedId;
        }
        return this;
    }
}

export default Accessory; 