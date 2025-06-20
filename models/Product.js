import { ObjectId } from 'mongodb';

class Product {
    constructor(data) {
        this._id = data._id || new ObjectId();
        this['Company Name'] = data['Company Name'] || '';
        this['Model Name'] = data['Model Name'] || '';
        this['Price'] = data['Price'] || '';
        this['RAM'] = data['RAM'] || '';
        this['Processor'] = data['Processor'] || '';
        this['Launched Year'] = data['Launched Year'] || '';
        this['Image URL'] = data['Image URL'] || '';
        this.category = data.category || 'Smartphone'; // Default category

        // ERP Fields
        this.stock = data.stock || 0;
        this.costPrice = data.costPrice || 0;
        this.minStock = data.minStock || 10;
        this.maxStock = data.maxStock || 200;
    }

    static async findById(db, id) {
        const collection = db.collection('Products');
        const product = await collection.findOne({ _id: new ObjectId(id) });
        return product ? new Product(product) : null;
    }

    static async findAll(db, query = {}, options = {}) {
        const collection = db.collection('Products');
        return await collection.find(query, options).toArray();
    }

    async save(db) {
        const collection = db.collection('Products');
        const productData = {
            'Company Name': this['Company Name'],
            'Model Name': this['Model Name'],
            'Price': this.Price,
            'RAM': this.RAM,
            'Processor': this.Processor,
            'Launched Year': this['Launched Year'],
            'Image URL': this['Image URL'],
            category: this.category,
            stock: this.stock,
            costPrice: this.costPrice,
            minStock: this.minStock,
            maxStock: this.maxStock
        };

        if (this._id) {
            await collection.updateOne(
                { _id: this._id },
                { $set: productData }
            );
        } else {
            await collection.insertOne({ ...productData, _id: this._id });
        }
        return this;
    }
}

export default Product;
