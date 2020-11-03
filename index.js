const express = require("express");
const app = express();
const fs = require('fs')
require("dotenv").config();
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const passport = require("passport");
const session = require("express-session");
const {  User } = require("./models/userModel");
const multer = require("multer");
const flash = require('connect-flash');

/*----Database Connection URI----*/
mongoose
  .connect(process.env.DB, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("DB connection successful!"));

/*----Google Authentication URL----*/
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "https://resumevault.herokuapp.com/auth/google/account",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
    },
    function(accessToken, refreshToken, profile, done) {
      //check user table for anyone with a facebook ID of profile.id
      User.findOne({ googleId: profile.id }, function(err, user) {
        if (err) {
          return done(err);
        }
        //No user was found... so create a new user with values from Facebook (all the profile. stuff)
        if (!user) {
          user = new User({
            googleId: profile.id,
            name: profile.displayName,
            photo: profile._json.picture,
            email: profile.emails[0].value,
            username:profile.emails[0].value
          });
          user.save(function(err) {
            if (err) console.log(err);
            return done(err, user);
          });
        } else {
          //found user. Return
          return done(err, user);
        }
      });
    }
  )
);

/*----Serialize User----*/
passport.serializeUser(function(user, done) {
  done(null, user.id);
});
/*----Deserialize User----*/
passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

/*----Storage Options----*/
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, __dirname+'/uploads/')
  },
  filename: function (req, file, cb) {
    if(req.isAuthenticated()){
      cb(null, req.user.email+".pdf");
    }
  }
})

/*---Upload limits and File type */
var upload = multer({ 
  fileFilter(req,file,cb){
    if(!file.originalname.endsWith('.pdf')){
      return cb(new Error('File must be a pdf'));
    }
      console.log(file);
     cb(undefined,true);
  },
      storage: storage
 });

/*----some middleware----*/
app.use(express.static("public"));
app.use(express.static("uploads"));
app.set("view engine", "ejs");
app.use(
  bodyParser.urlencoded({
    extended: true
  })
);
app.use(
  session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
  })
);
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

/*----Home Page----*/
app.get("/", (req, res) => {
  if(req.isAuthenticated()){
    res.redirect("/profile");
  }else{
    res.render("index");
  }
});

/*----Google Auth----*/
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

/*----Google Auth CallBack----*/
app.get(
  "/auth/google/account",
  passport.authenticate("google", { failureRedirect: "/" }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect("/profile");
  }
);

/*----Account Page----*/
app.get("/profile", (req, res) => {
    if(req.isAuthenticated()){
      //console.log(req.user);
      res.render("profile",{user:req.user});
    }else{
      res.redirect("/");
    }
});

// chnage username
app.post("/username",(req,res)=>{
  console.log("In index.js and username is "+ req.body.username);
  if(req.isAuthenticated()){
    User.findOne({username:req.body.username},(err,found)=>{
      if(found)
      res.json({status:false,message:"Username already exists!"});
      else{
        User.findById(req.user.id,async(err,found)=>{
          if(found){
            found.username=req.body.username;
            await found.save();
            res.json({status:true,message:"Username changed"});
          }
        })
      }
    })
  }
});

/*----Upload Resume----*/
app.post("/upload",upload.single("upload"),(req,res)=>{
  User.findById(req.user.id,async(err,found)=>{
    let resume={data: fs.readFileSync(__dirname + '/uploads/' + found.email+".pdf"), 
            contentType: 'application/pdf'};
    found.resume=resume;
    found.status=true;
    await found.save();
    res.json({upload:true});
  });
},(error,req,res,next)=>{
  res.json({upload:false,error:error.message});
});

/*----Delete Resume----*/
app.get("/delete",(req,res)=>{
  if(req.isAuthenticated()){
    User.findById(req.user.id,async(err,found)=>{
      found.status=false;
      found.resume.data="";
      await found.save();
      res.json({message:"Resume Deleted Successfully"});
    })
  }else{
    res.json({message:"Authentication Failed"});
  }
});

/*----logout----*/
app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
});

/*----Find Resume using email----*/
app.post("/findResume",(req,res)=>{
  User.findOne({$or:[{email:req.body.email},{username:req.body.email}]},(err,found)=>{
    if(found && found.status){
      res.json({status:true,email:found.email});
    }else{
      res.json({status:false});
    }
  });
});

/*----Find Resume using url----*/
app.get("/:id",(req,res)=>{
  //console.log(req.params.id);
  User.findOne({$or:[{email:req.params.id},{username:req.params.id}]},(err,found)=>{
    if(found && found.status){
      res.setHeader('content-type', 'application/pdf');
      res.end(found.resume.data);
    }else{
      res.render("error");
    }
  });
});

/*----server----*/
var port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("app is running on port 3000");
});
