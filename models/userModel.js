const mongoose = require("mongoose");
const findOrCreate = require("mongoose-findorcreate");

const userSchema = new mongoose.Schema({
  name: String,
  photo: String,
  googleId: String,
  email: String,
  status:Boolean,
  username:String
});

userSchema.plugin(findOrCreate);
const User = new mongoose.model("User", userSchema);

module.exports = {  User };
