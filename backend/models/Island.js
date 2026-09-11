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
  },
  type: {
    type: String,
    default: 'Atoll'
  },
  hazardStatus: {
    type: String,
    enum: ['Clear', 'Dangerous', 'Storm-battered', 'Blocked'],
    default: 'Clear'
  },
  isCustom: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Island', islandSchema);
