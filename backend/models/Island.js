const mongoose = require('mongoose');

const islandSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  lat: {
    type: Number,
    required: true
  },
  lng: {
    type: Number,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Island', islandSchema);
