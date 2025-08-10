/********************************************************************************
*  WEB322 – Assignment 06
* 
*  I declare that this assignment is my own work in accordance with Seneca's
*  Academic Integrity Policy:
* 
*  https://www.senecacollege.ca/about/policies/academic-integrity-policy.html
* 
*  Name: Siyang Jiang Student ID: 172747230 Date: Aug 10th 2025
*
*  Published URL
*
********************************************************************************/

require('dotenv').config();

const express = require('express');
const path = require('path');
const app = express();
const projectService = require("./modules/projects.js");
const authData = require('./modules/auth-service');
const clientSessions = require('client-sessions');

const projectData = require("./data/projectData.json");
const sectors = require("./data/sectorData.json");

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Client Sessions
app.use(clientSessions({
  cookieName: 'session',
  secret: process.env.SESSION_SECRET || 'dev-session',
  duration: 2 * 60 * 60 * 1000, 
  activeDuration: 1000 * 60 * 5 
}));

app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

function ensureLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }
  next();
}

app.get('/', (req, res) => {
    res.render('home');
});

app.get('/about', (req, res) => {
    res.render('about');
});

app.get('/solutions/projects', (req, res) => {
    const sector = req.query.sector;
    let getProjects;

    if (sector) {
        getProjects = projectService.getProjectsBySectorId(sector);
    } else {
        getProjects = projectService.getAllProjects();
    }

    Promise.all([getProjects, projectService.getAllSectors()])
        .then(([projects, sectors]) => {
            res.render('projects', { projects, sectors });
        })
        .catch(err => {
            res.render('500', { message: `I'm sorry, but we have encountered the following error: ${err}` });
        });
});


app.get('/solutions/projects/:id', (req, res) => {
    projectService.getProjectById(req.params.id)
        .then(project => {
            if (!project) {
                return res.status(404).render('404', { message: "Project not found." });
            }
            res.render('project', { project, sectorName: project.Sector ? project.Sector.sector_name : "Unknown" });
        })
        .catch(err => {
            res.status(404).render('404', { message: err });
        });
});


// NEW: Add Project Routes

app.get("/solutions/addProject", ensureLogin, (req, res) => {
    projectService.getAllSectors()
        .then(sectors => {
            res.render("addProject", { sectors: sectors });
        })
        .catch(err => {
            res.render("500", { message: `I'm sorry, but we have encountered the following error: ${err}` });
        });
});

app.post("/solutions/addProject", ensureLogin, (req, res) => {
    console.log("Form data received:", req.body);

    projectService.addProject(req.body)
        .then(() => {
            res.redirect("/solutions/projects");
        })
        .catch(err => {
            res.render("500", { message: `I'm sorry, but we have encountered the following error: ${err}` });
        });
});

// NEW: eidt Project
app.get("/solutions/editProject/:id", ensureLogin, (req, res) => {
    Promise.all([
        projectService.getProjectById(req.params.id),
        projectService.getAllSectors()
    ])
    .then(([project, sectors]) => {
        res.render("editProject", { project: project, sectors: sectors });
    })
    .catch(err => {
        res.status(404).render("404", { message: err });
    });
});

app.post("/solutions/editProject", ensureLogin, (req, res) => {
    projectService.editProject(req.body.id, req.body)
        .then(() => {
            res.redirect("/solutions/projects");
        })
        .catch(err => {
            res.render("500", { message: `I'm sorry, but we have encountered the following error: ${err}` });
        });
});


// delete
app.get("/solutions/deleteProject/:id", ensureLogin, (req, res) => {
    projectService.deleteProject(req.params.id)
        .then(() => {
            res.redirect("/solutions/projects");
        })
        .catch(err => {
            res.render("500", { message: `I'm sorry, but we have encountered the following error: ${err}` });
        });
});


// Auth Routes
// GET /login -> show login page
app.get('/login', (req, res) => {
  res.render('login', { errorMessage: '', userName: '' });
});

app.get('/register', (req, res) => {
  res.render('register', { errorMessage: '', successMessage: '', userName: '' });
});

app.post('/register', (req, res) => {
  authData.registerUser(req.body)
    .then(() => {
      res.render('register', { errorMessage: '', successMessage: 'User created', userName: '' });
    })
    .catch((err) => {
      res.render('register', { errorMessage: err, successMessage: '', userName: req.body.userName });
    });
});

app.post('/login', (req, res) => {
  req.body.userAgent = req.get('User-Agent');

  authData.checkUser(req.body)
    .then((user) => {
      req.session.user = {
        userName: user.userName,
        email: user.email,
        loginHistory: user.loginHistory
      };
      res.redirect('/solutions/projects');
    })
    .catch((err) => {
      res.render('login', { errorMessage: err, userName: req.body.userName });
    });
});

// GET /logout -> reset session and go home
app.get('/logout', (req, res) => {
  if (req.session) req.session.reset();
  res.redirect('/');
});

// GET /userHistory -> show login history (protected)
app.get('/userHistory', ensureLogin, (req, res) => {
  res.render('userHistory');
});

// 404 Handler
app.use((req, res) => {
    res.status(404).render('404', { message: "Nothing Found!" });
});

const PORT = process.env.PORT || 3000;

projectService.initialize()
    .then(authData.initialize)
    .then(() => {
        app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
    })
    .catch(err => {
        console.log("unable to start server: " + err);
    });
