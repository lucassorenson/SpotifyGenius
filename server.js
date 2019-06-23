const express         = require('express');
const passport        = require('passport')
const SpotifyStrategy = require('passport-spotify').Strategy;
const session         = require('express-session')
const app             = express();
const port            = 4000;
const axios           = require('axios');
const cors            = require('cors')
const User            = require('./database.js').User
const path            = require('path')
const { URLSearchParams } = require('url');
const fetch           = require('node-fetch')
const api             = require('genius-api')


const spotifyClientId = 'a7e8b924f0734e9786ff52b834edba2e';
const spotifyClientSecret = '8075c06c97294d99bc0af5241e54776a';
const callbackURL = 'http://localhost:4000/auth/spotify/callback';
const spotifyURL = 'https://api.spotify.com/v1/me/player/currently-playing';

const geniusClientAccessToken = 'PgCy4kYoynAK9Xpm9ginVEQ-buQXznqswsqZaAbeKpffd5OcYlyugSOraAjYj68k'
const genius          = new api(geniusClientAccessToken)

passport.serializeUser(function(user, done) {
    done(null, user.id);
});
  
passport.deserializeUser(function(id, done) {
    User.findOne({spotifyId: id}, function(err, user) {
        done(err, user)
    })
});

passport.use( 
    new SpotifyStrategy({
        clientID: spotifyClientId,
        clientSecret: spotifyClientSecret,
        callbackURL: callbackURL
    }, 
    function(accessToken, refreshToken, expires_in, profile, done) {
        const expiresOn = new Date()
        expiresOn.setHours(expiresOn.getHours() + 1)

        User.findOne({spotifyId: profile.id})
        .then(function(user, err){
            if (user && user.accessTokenExpiresOn > new Date()) {
               return done(null, user)
            } else if (user && user.accessTokenExpiresOn <= new Date()) {
                const params = new URLSearchParams();
                params.append('grant_type', 'refresh_token')
                params.append('refresh_token', user.refreshToken)

                const headers = {
                    Authorization: 'Basic ' + (Buffer.from(spotifyClientId + ':' + spotifyClientSecret).toString('base64')),
                    "Content-Type": "application/x-www-form-urlencoded"
                }

                fetch('https://accounts.spotify.com/api/token', {method: 'POST', body: params, headers: headers})
                .then((data) => data.json())
                .then(function(data) {
                    user.accessToken = data.access_token;
                    user.accessTokenExpiresOn = expiresOn;

                    user.save()
                    .then(function(user) {
                        return done(null, user)
                    })
                })

                .catch((error) => console.log(error.message))
            } else {
                let newUser = new User({
                    spotifyId: profile.id,
                    accessToken: accessToken,
                    accessTokenExpiresOn: expiresOn,
                    refreshToken: refreshToken
                })
                newUser.save()
                .then(function(newUser) {
                   return done(null, newUser)
                })
            }
        })
    })
)

app.use(express.static(path.join(__dirname, 'client/public')));
app.use(session({ secret: 'OFofofppajj', resave: true, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

const corsOptions = {
    origin: 'http://localhost:3000',
    credentials: true
}

app.use(cors(corsOptions))

app.get('/auth/spotify', passport.authenticate('spotify', {scope: 'user-read-currently-playing'}))

app.get('/auth/spotify/callback', passport.authenticate('spotify', {failureRedirect: '/'}), function(req, res) {
    req.session.user = req.user;
    res.redirect('http://localhost:3000/profile')
})

app.get('/getGenius', function(req, res) {
    genius.search(req.query.songName)
    .then(function(response) {
        let reqArtist = req.query.artist.toLowerCase();

        for (let i = 0; i < response.hits.length; i++) {
            let resArtist = response.hits[i].result.primary_artist.name.replace(/\u200B/g, '').toLowerCase()

            if (reqArtist === resArtist) {
                return genius.song(response.hits[i].result.id)
            }
        }
        return null
    })
    .then(function(data) {
        if (data) {
            res.send(data.song.embed_content)
        } else {
            res.send(null)
        }
        
    })
})

const getSong = async function(req) {
    const key = req.session.user.accessToken
    const songData = await axios.get(spotifyURL, {headers: {Authorization: `Bearer ${key}`}});
    if (songData.status === 200) {
        return songData.data.item
    } else if (songData.status === 204) {
        return 'Nothing is playing right now.'
    } else {
        return 'Something went wrong in server.js at **const getSong**'
    }
}

app.get('/getProfile', function(req, res) {
    res.send(req.session.user.spotifyId)
})

app.get('/getSong', function(req, res) {
    getSong(req)
    .then(function(data){
        res.send(data)
    })
    .catch(function(error) {
        if (error.request && error.request.res.statusCode === 401) {
            console.log('BAD AUTH CODE')
        } else {
            console.log(error)
        }
    })
})

app.get('*', (req,res) =>{
    res.sendFile(path.join(__dirname+'/client/public/index.html'));
});

app.listen(port, function() {
    console.log(`Listening at port ${port}`)
})

