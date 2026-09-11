const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
  fromIsland: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Island',
    required: true
  },
  toIsland: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Island',
    required: true
  },
  distance: {
    type: Number,
    required: true
  },
  speed: {
    type: Number,
    default: 10
  },
  isHazard: {
    type: Boolean,
    default: false
  },
  isPatrolZone: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Route', routeSchema);
