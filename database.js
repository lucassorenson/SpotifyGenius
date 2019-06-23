const mongoose = require('mongoose')
const Schema   = mongoose.Schema

const DB = 'mongodb+srv://Luke:Luke@message-board-ebzab.mongodb.net/Users?retryWrites=true&w=majority'

const userSchema = new Schema({
    spotifyId: {type: String, unique: true},
    username: String,
    password: String,
    accessToken: String,
    accessTokenExpiresOn: Number,
    refreshToken: String
})

mongoose.connect(DB, {useNewUrlParser: true, useFindAndModify: false, useCreateIndex: true}, function(err) {
    if (err) {
        console.log(err)
    } else {
        console.log('Connected to DB')
    }
})

const User = mongoose.model("User", userSchema)
module.exports.User = User