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
      callbackURL: "https://murmuring-forest-14129.herokuapp.com/auth/google/account",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
    },
    function (accessToken, refreshToken, profile, cb) {
      //console.log(profile);
      User.findOrCreate(
        {
          googleId: profile.id,
          name: profile.displayName,
          photo: profile._json.picture,
          email: profile.emails[0].value
        },
        function (err, user) {
          return cb(err, user);
        }
      );
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
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    if(req.isAuthenticated()){
      cb(null, req.user.email+".pdf");
    }
  }
})

/*---Upload limits and File type */
var upload = multer({ storage: storage,
  fileFilter(req,file,cb){
    if(!file.originalname.endsWith('.pdf')){
      return cb(new Error('File must be a pdf'))
    }
      console.log(file);
     cb(undefined,true);
  },
  limits:{
        fileSize: 100000
      }
 });

// const upload=multer({
//   dest:"resume",
//   limits:{
//     fileSize: 100000
//   },
//   fileFilter(req,file,cb){
//     if(!file.originalname.endsWith('.pdf')){
//       return cb(new Error('File must be a pdf'))
//     }
//       console.log(file);
//      cb(undefined,true);
//   }
// })

/*----some middleware----*/
app.use(express.static("public"));
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
  res.render("index",{message:req.flash("info")});
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
      res.render("profile",{user:req.user,message:req.flash("info")});
    }else{
      res.redirect("/");
    }
});

/*----Upload Resume----*/
app.post("/upload",upload.single("upload"),(req,res)=>{
  User.findById(req.user.id,async(err,found)=>{
    found.status=true;
    await found.save();
    req.flash("info", "Resume uploaded successfully");
    res.redirect("/account");
  });
},(error,req,res,next)=>{
  req.flash("info", error.message);
  res.redirect("/account");
});

/*----logout----*/
app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
});


/*----Find Resume using email----*/
app.post("/findResume",(req,res)=>{
  User.findOne({email:req.body.email},(err,found)=>{
    if(found){
      res.redirect(`/${found.email}.pdf`)
    }else{
      req.flash("info","NOT found");
      res.redirect("/");
    }
  });
});

/*----Delete Resume----*/
app.get("/delete",(req,res)=>{
  if(req.isAuthenticated()){
    const path = `uploads/${req.user.email}.pdf`;
    fs.unlink(path, (err) => {
      if (err) {
        console.error(err);
      }
      User.findById(req.user.id,async(err,found)=>{
        found.status=false;
        await found.save();
        req.flash("info","Resume deleted successfully!");
        res.redirect("/account");
      })
    });
  }else{
    res.redirect("/");
  }
});

/*----Find Resume using url----*/
app.get("/:id",(req,res)=>{
  console.log(req.params.id);
  User.findOne({email:req.params.id},(err,found)=>{
    if(found){
      res.redirect(`/${found.email}.pdf`)
    }else{
      req.flash("info","NOT found");
      res.redirect("/");
    }
  });
});

/*----server----*/
var port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("app is running on port 8000");
});
