exports.main = function(options) {
  const ss = require("simple-storage").storage,
        obbs = require("observer-service"),
        tabs = require("tabs"),
        urlFactory = require("url"),
        data = require("self").data,
        winUtils = require("window-utils"),
        {Cc,Ci,Cu} = require("chrome"),
        {AboutHandler, ProtocolHandler} = require('./protocol'),
        {MatchPattern} = require("match-pattern"),
        panelFactory = require("panel"),
        tbb = require("toolbarbutton"),
        {unload} = require("unload+"),
        {listen} = require("listen"),
        ao = require("achievement-overlay");

  let protocol = {
    about: function(about, handler) {
      return AboutHandler.extend(handler, { scheme: about }).new()
    },
    protocol: function(scheme, handler) {
      return ProtocolHandler.extend(handler, { scheme: scheme }).new()
    }
  }
  const aboutCheevosUrl = "about:cheevos";

  let objHolder = {};
  Cu.import("resource://gre/modules/PlacesUtils.jsm", objHolder);
  let PlacesUtils = objHolder.PlacesUtils;

  const debug = true;
  log("cheevos loaded");

  const PTS_PER_BASIC   = 10,
        PTS_PER_BRONZE  = 10,
        PTS_PER_SILVER  = 20,
        PTS_PER_GOLD    = 50,
		PTS_PER_DIAMOND = 75;
  let totalAwards    = 0,
      acquiredAwards = 0,
      acquiredPoints = 0,
      unloaders    = [],
      destroyFuncs = [];

  let strings = {
    cheevos: {
      lwThemeChanged: {
        id: "lightweight-theme-changed",
        obs: "lightweight-theme-changed",
        description: "'Wearing' a persona is just one of the many ways to customize Firefox.",
        hint: "I'm always telling myself I have multiple personalities.",
        learnMoreUrl: "http://www.getpersonas.com",
        learnMoreLabel: "Your Firefox, Your Style",
        name: "Split Personalities",
        subAwards: true,
        bronzeId: "lightweight-theme-changed", /* migrated from generic award */
        silverId: "lightweight-theme-changedSilver",
        goldId: "lightweight-theme-changedGold"
      },
      dmRemoveDownload: {
        id: "download-manager-remove-download",
        obs: "download-manager-remove-download",
        description: "Keeping your downloads list clean can make it easier to find your special files.",
        hint: "Ever wanted to forget something you downloaded?",
        learnMoreUrl: "http://support.mozilla.com/kb/Downloads window",
        learnMoreLabel: "Downloads window",
        name: "Tidy up!",
        subAwards: true,
        bronzeId: "dmRemoveDownloadBronze",
        silverId: "dmRemoveDownloadSilver",
        goldId: "dmRemoveDownloadGold"
      },
      privateBrowsingEnter: {
        id: "private-browsing",
        obs: "private-browsing",
        description: "In Private Browsing mode, Firefox won't keep any history or cookies.",
        hint: "All your secrets are belong to you.",
        learnMoreUrl: "http://support.mozilla.com/kb/Private Browsing",
        learnMoreLabel: "Private Browsing",
        name: "Shopping for gifts?",
        subAwards: true,
        bronzeId: "private-browsing", /* migrated from generic award */
        silverId: "private-browsingSilver",
        goldId: "private-browsingGold",
      },
      pmLoginAdded: {
        id: "passwordmgr-storage-changed",
        obs: "passwordmgr-storage-changed",
        description: "The Password Manager securely stores the usernames and passwords so you don't have to.",
        hint: "An improvement over hidden Post-it notes.",
        learnMoreUrl: "http://support.mozilla.com/kb/make-firefox-remember-usernames-and-passwords",
        learnMoreLabel: "Password Manager",
        name: "hunter2",
        subAwards: true,
        bronzeId: "passwordmgr-storage-changed", /* migrated from generic award */
        silverId: "passwordmgr-storage-changedSilver",
        goldId: "passwordmgr-storage-changedGold",
      },
      homepageChanged: {
        id: "homepageChanged",
        obs: "browser.startup.homepage",
        description: "Setting a homepage allows you to see your favorite webpage every time you open Firefox.",
        hint: "There's no place like home.",
        learnMoreUrl: "http://support.mozilla.com/kb/How to set the home page",
        learnMoreLabel: "Setting a home page",
        name: "Home Sweet Home",
        award: "bronze",
      },
      addOnsOpened: {
        id: "Tools:Addons",
        obs: "Tools:Addons",
        description: "Add-ons provide thousands of extra features and styles to make Firefox your own.",
        hint: "Go-go-gadget!",
        learnMoreUrl: "https://addons.mozilla.org",
        learnMoreLabel: "Find more",
        name: "Inspector Gadget",
        url: "about:addons",
        subAwards: true,
        bronzeId: "addOnsBronze",
        silverId: "addOnsSilver",
        goldId: "addOnsGold",
      },
      aboutMisc: {
        id: "aboutMisc",
        obs: "aboutMisc",
        description: "Mozilla has a long history of adding both quirky and useful about: pages.",
        hint: "Have I ever told you about...",
        learnMoreUrl: "http://www.mozilla.org",
        learnMoreLabel: "Learn more",
        name: "Let's talk about it",
        subAwards: true,
        bronzeId: "aboutPagesBronze",
        silverId: "aboutPagesSilver",
        goldId: "aboutPagesGold",
        },
      configOpened: {
        id: "about:config",
        obs: "about:config",
        description: "At 'about:config' all user preferences can be viewed and modified.",
        hint: "It's always good to keep your options open.",
        learnMoreUrl: "http://kb.mozillazine.org/About:config",
        learnMoreLabel: "Learn more",
        name: "Super User",
        url: "about:config",
        award: "silver",  /* migrated from generic award */
        subAwards: true,
        bronzeId: "about:configBronze",
        silverId: "about:config", /* migrated from generic award */
        goldId: "about:configGold",
      },
      knowUrRights: {
        id: "about:rights",
        obs: "about:rights",
        description: "You may use, modify, copy and distribute Firefox to others.",
        hint: "The truth won't be told by the few who know. ",
        learnMoreUrl: "http://www.mozilla.org/about/manifesto.html",
        learnMoreLabel: "The Mozilla Manifesto",
        name: "Know Your Rights",
        url: "about:rights",
        award: "bronze",
      },
      frequentFlyer: {
        id: "frequentFlyer",
        obs: "frequentFlyer",
        description: "Open multiple tabs at the same time for super-advanced high speed browsing.",
        hint: "Have you ever been in many places at the same time?",
        name: "Same time, same place",
        subAwards: true,
        bronzeId: "frequentFlyerBronze",
        silverId: "frequentFlyerSilver",
        goldId: "frequentFlyerGold",
      },
      revolutionTelevised: {
        id: "revolutionTelevised",
        obs: "revolutionTelevised",
        description: "Air Mozilla is the Internet multimedia presence of Mozilla.",
        hint: "The Revolution Will Not Be Televised",
        learnMoreUrl: "https://air.mozilla.org",
        learnMoreLabel: "Tune in",
        name: "Mozilla, in Video",
        url: "*.air.mozilla.org",
        award: "bronze",
      },
      yoDawg: {
        id: "yoDawg",
        obs: "chrome://browser/content/browser.xul",
        description: "Firefox is made using XUL, JavaScript, and CSS. Very similar technology to websites.",
        hint: "I heard you like browsers",
        learnMoreUrl: "https://developer.mozilla.org/En/XUL",
        learnMoreLabel: "Learn more",
        name: "Yo Dawg",
        url: "chrome://browser/content/browser.xul",
        award: "bronze",
      },
      bookmarkAdded: {
        id: "bookmarkAdded",
        obs: "bookmarkAdded",
        description: "Bookmarks keep track of websites that you would like to come back to.",
        learnMoreUrl: "http://support.mozilla.com/kb/how-do-i-use-bookmarks",
        learnMoreLabel: "Learn more",
        hint: "When you wish upon a star...",
        name: "Dog eared",
        subAwards: true,
        bronzeId: "bookmarkAddedBronze",
        silverId: "bookmarkAddedSilver",
        goldId: "bookmarkAddedGold",
      },
      feedbackSubmitted: {
        id: "feedbackSubmitted",
        obs: "feedbackSubmitted",
        description: "Your feedback will be used to create a better experience in future releases of Firefox.",
        learnMoreUrl: "https://input.mozilla.org/feedback",
        learnMoreLabel: "Submit more feedback",
        hint: "If you're happy and you know it...",
        url: /https?:\/\/input.mozilla.(org|com)\/[^/]*\/thanks/,
        name: "Your opinion matters",
        award: "bronze",
      },
      releaseChannels: {
        id: "releaseChannels",
        obs: "releaseChannels",
        description: "Thanks for testing the latest innovations in Firefox.",
        learnMoreUrl: "http://www.mozilla.org/projects/firefox/prerelease.html",
        learnMoreLabel: "How you can help Firefox",
        hint: "The future comes one day at a time.",
        name: "Back to the Future!",
        subAwards: true,
        bronzeId: "releaseChannelsBronze",
        silverId: "releaseChannelsSilver",
        goldId: "releaseChannelsGold",
        hidden: true,
      },
      devTools: {
        id: "devTools",
        obs: "devTools",
        description: "Firefox comes out of the box with some of the best tools for web development.",
        learnMoreUrl: "http://hacks.mozilla.org/category/developer-tools/",
        learnMoreLabel: "hacks.mozilla.org",
        hint: "The ultimate tool for web developers.",
        name: "Made with Notepad",
        subAwards: true,
        bronzeId: "devToolsBronze",
        silverId: "devToolsSilver",
        goldId: "devToolsGold",
      },
      socialKing: {
        id: "socialKing",
        obs: "socialKing",
        description: "Visit Twitter, Facebook, and Google+",
        hint: "How social are you?",
        name: "Social is the key",
        subAwards: true,
        bronzeId: "socialKingBronze",
        silverId: "socialKingSilver",
        goldId: "socialKingGold",
        hidden: true,
      },
    },
  };

  let totalCheevos = [];
  for (let index in strings.cheevos) {
    totalCheevos[totalCheevos.length] = strings.cheevos[index];
    totalAwards += strings.cheevos[index].subAwards ? 3 : 1;
  }

  if (!ss.cheevosAcquired)
    ss.cheevosAcquired = {};

  for (let i in strings.cheevos) {
    let cheevo = strings.cheevos[i];
    if (cheevo.subAwards) {
      if (ss.cheevosAcquired[cheevo.bronzeId]) {
        acquiredAwards++;
        acquiredPoints += PTS_PER_BRONZE;
      }
      if (ss.cheevosAcquired[cheevo.silverId]) {
        acquiredAwards++;
        acquiredPoints += PTS_PER_SILVER;
      }
      if (ss.cheevosAcquired[cheevo.goldId]) {
        acquiredAwards++;
        acquiredPoints += PTS_PER_GOLD;
      }
    } else if (ss.cheevosAcquired[cheevo.id]) {
      acquiredAwards++;
      acquiredPoints += PTS_PER_BASIC;
    }
  }

  if (!ss.hostCount)
    ss.hostCount = [{},{},{}];
  if (!ss.aboutsVisited)
    ss.aboutsVisited = {};
  if (!ss.aboutsVisitedCount)
    ss.aboutsVisitedCount = 0;
  if (!ss.downloadsRemoved)
    ss.downloadsRemoved = 0;
  if (!ss.bookmarksAdded)
    ss.bookmarksAdded = 0;
  if (!ss.socialSites)
	ss.socialSites = true;
  if (!ss.privateBrowsingEntrances)
    ss.privateBrowsingEntrances = 0;
  if (!ss.lwThemeChanges)
    ss.lwThemeChanges = 0;
  if (!ss.pmLoginsAdded)
    ss.pmLoginsAdded = 0;
  if (!ss.scratchPadOpenings)
    ss.scratchPadOpenings = 0;
  if (!ss.errorConsoleOpenings)
    ss.errorConsoleOpenings = 0;
  if (!ss.viewSourceOpenings)
    ss.viewSourceOpenings = 0;
  addObs(strings.cheevos.lwThemeChanged.obs, onLightweightThemeChanged, this);
  addObs(strings.cheevos.dmRemoveDownload.obs, onDownloadManagerRemoveDownload, this);
  addObs(strings.cheevos.privateBrowsingEnter.obs, onPrivateBrowsingEnter, this);
  addObs(strings.cheevos.pmLoginAdded.obs, onPMLoginAdded, this);
  tabs.on('ready', onDOMContentLoaded);

  function toolbarbuttonLabel(points) {
    return points.toString() + (points == 1 ? "pt" : "pts");
  };

  let toolbarbutton = tbb.ToolbarButton({
    id: "cheevos-toolbarbutton",
    label: toolbarbuttonLabel(acquiredPoints),
    alwaysShowLabel: true,
    title: "Cheevos",
    image: data.url("trophy_icon.png"),
    onCommand: function () {
      let aboutCheevosAlreadyOpen = false;
      for each (let tab in tabs) {
        if (tab.url == aboutCheevosUrl) {
          aboutCheevosAlreadyOpen = true;
          tab.activate();
          tab.reload();
        }
      }

      if (!aboutCheevosAlreadyOpen)
        loadCheevosPage();
    }
  });
  if (!ss.cheevosAcquired[strings.cheevos.addOnsOpened.goldId]) {
    toolbarbutton.moveTo({
      toolbarID: "nav-bar",
      forceMove: true
    });
  }
  let achievementOverlay = ao.AchievementOverlay({
    id: "cheevos-achievementOverlay",
    onCommand: function () { loadCheevosPage(); }
  });
  let sss = Cc["@mozilla.org/content/style-sheet-service;1"]
              .getService(Ci.nsIStyleSheetService);
  let ios = Cc["@mozilla.org/network/io-service;1"]
              .getService(Ci.nsIIOService);
  let chromeStylesheet = data.url("chrome.css");
  let chromeStylesheetUri = ios.newURI(chromeStylesheet, null, null);
  sss.loadAndRegisterSheet(chromeStylesheetUri, sss.AGENT_SHEET);

  // show cheevo for installing the addon
  onObservation(strings.cheevos.addOnsOpened, true, "bronze");

  function addObs(topic, callback, thisRef) {
    obbs.add(topic, callback, thisRef);
  }

  function log(aMessage) {
    if (debug)
      console.info("cheevos: " + aMessage);
  }

  function getCheevoListBlockText() {
    log("getCheevoListBlockText");
    let h = '';
    for (let i in totalCheevos) {
      let cheevo = totalCheevos[i];
      if (cheevo.hidden && !ss.cheevosAcquired[cheevo.id] && !ss.cheevosAcquired[cheevo.bronzeId] &&
          !ss.cheevosAcquired[cheevo.silverId] && !ss.cheevosAcquired[cheevo.goldId])
        continue;
      let achieved = cheevo.subAwards ? ss.cheevosAcquired[cheevo.goldId] : ss.cheevosAcquired[cheevo.id];
      log(cheevo.id + " is " + (achieved ? "achieved" : "not achieved"));
      if (cheevo.subAwards)
        h += achieved ? "<li class='cheevo-block awards achieved'>" : "<li class='cheevo-block'>";
      else
        h += achieved ? "<li class='cheevo-block achieved'>" : "<li class='cheevo-block'>";
      h += "<h3 class=name>" + cheevo.name + "</h3>"
      h += "<p class=message>" + (achieved ? cheevo.description : cheevo.hint) + "</p>";
      if (cheevo.subAwards) {
        h += "<ol class=awards>";
        if (ss.cheevosAcquired[cheevo.bronzeId])
          h += "<li class='bronze achieved' title='" + ss.cheevosAcquired[cheevo.bronzeId] + "'></li>";
        else
          h += "<li class='bronze'></li>";
        if (ss.cheevosAcquired[cheevo.silverId])
          h += "<li class='silver achieved' title='" + ss.cheevosAcquired[cheevo.silverId] + "'></li>";
        else
          h += "<li class='silver'></li>";
        if (ss.cheevosAcquired[cheevo.goldId])
          h += "<li class='gold achieved' title='" + ss.cheevosAcquired[cheevo.goldId] + "'></li>";
        else
          h += "<li class='gold'></li>";
        h += "</ol>";
      } else {
        if (ss.cheevosAcquired[cheevo.id])
          h += "<div class='" + cheevo.award + "' title='" + ss.cheevosAcquired[cheevo.id] + "'></div>";
        else
          h += "<div class='" + cheevo.award + "'></div>";

      }
      if (achieved && cheevo.learnMoreUrl && cheevo.learnMoreLabel) {
        h += "<div class=learnMore><a href='" + cheevo.learnMoreUrl + "'>" + cheevo.learnMoreLabel + "</a></div>";
      }
      h += "</li>";
    }
    return h;
  }

  function onCheevosPageOpened(tab) {
    log("onCheevosPageOpened");
    let tweetText = "I've got " + toolbarbuttonLabel(acquiredPoints) + " with Cheevos for Firefox. Can you beat me?";
    let stats = "You've got " + toolbarbuttonLabel(acquiredPoints) + ", with " + acquiredAwards + "/" + totalAwards + " awards.";
    let styleCss = data.url("cheevo.css");
    tab.attach({
      contentScriptFile: data.url("cheevo.js"),
      contentScript: "populateTemplate('" + escape(tweetText) + "','" + escape(stats) + "','" +
                                       escape(getCheevoListBlockText()) + "','" + escape(styleCss) + "');",
    });
  }

  function loadCheevosPage() {
    tabs.open({
      url: aboutCheevosUrl,
      onReady: function onReady(tab) { onCheevosPageOpened(tab); }
    });
  }

  function notify(cheevo, points, awardsClass) {
    log("showing notification: " + cheevo.name);

    for each (let tab in tabs) {
      if (tab.url == aboutCheevosUrl) {
        tab.reload();
      }
    }

    achievementOverlay.show({
      title: cheevo.name,
      text: cheevo.hint,
      points: points,
      awardsClass: awardsClass,
    });
  }

  function onObservation(cheevo, shouldShow, specificAward) {
    log("onObservation: " + cheevo.obs);
    function acquireCheevo(cheevo, id, points, awardsClass) {
      if (!ss.cheevosAcquired[id]) {
        ss.cheevosAcquired[id] = new Date().toDateString();
        acquiredAwards++;
        notify(cheevo, points, awardsClass);
        toolbarbutton.updateLabel(toolbarbuttonLabel(acquiredPoints));
      };
    };
    if (!shouldShow)  
      return;
    if (specificAward) {
      switch (specificAward) {
        case "bronze":
          if (ss.cheevosAcquired[cheevo.bronzeId])
            return;
          acquiredPoints += PTS_PER_BRONZE;
          acquireCheevo(cheevo, cheevo.bronzeId, PTS_PER_BRONZE, "bronze");
          break;
        case "silver":
          if (ss.cheevosAcquired[cheevo.silverId])
            return;
          acquiredPoints += PTS_PER_SILVER;
          acquireCheevo(cheevo, cheevo.silverId, PTS_PER_SILVER, "silver");
          break;
        case "gold":
          if (ss.cheevosAcquired[cheevo.goldId])
            return;
          acquiredPoints += PTS_PER_GOLD;
          acquireCheevo(cheevo, cheevo.goldId, PTS_PER_GOLD, "gold");
          break;
        default:
          console.error("Cheevo: Unexpected observation specificAward");
          break;
      }
    } else {
      if (ss.cheevosAcquired[cheevo.id])
        return;
      acquiredPoints += PTS_PER_BASIC;
      acquireCheevo(cheevo, cheevo.id, PTS_PER_BASIC, "bronze generic");
    }
  }

  function onURLOpened(cheevo) {
    return onObservation(cheevo, true, (cheevo.award != "bronze") ? cheevo.award : false);
  }

  function onLightweightThemeChanged(subject, data) {
    ss.lwThemeChanges++;
    onObservation(strings.cheevos.lwThemeChanged, true, "bronze");
    if (ss.lwThemeChanges > 10)
      onObservation(strings.cheevos.lwThemeChanged, true, "silver");
    if (ss.lwThemeChanges > 50)
      onObservation(strings.cheevos.lwThemeChanged, true, "gold");
  }

  function onDownloadManagerRemoveDownload(subject, data) {
    ss.downloadsRemoved++;
    if (subject) {
      if (ss.downloadsRemoved >= 1)
        onObservation(strings.cheevos.dmRemoveDownload, true, "bronze");
      if (ss.downloadsRemoved >= 3)
        onObservation(strings.cheevos.dmRemoveDownload, true, "silver");
    } else {
      onObservation(strings.cheevos.dmRemoveDownload, true, "bronze");
      onObservation(strings.cheevos.dmRemoveDownload, true, "silver");
      onObservation(strings.cheevos.dmRemoveDownload, true, "gold");
    }
  }

  function onPrivateBrowsingEnter(subject, data) {
    ss.privateBrowsingEntrances++;
    onObservation(strings.cheevos.privateBrowsingEnter, data == "enter", "bronze");
    if (ss.privateBrowsingEntrances > 10)
      onObservation(strings.cheevos.privateBrowsingEnter, data == "enter", "silver");
    if (ss.privateBrowsingEntrances > 50)
      onObservation(strings.cheevos.privateBrowsingEnter, data == "enter", "gold");
  }

  function onPMLoginAdded(subject, data) {
    if (data == "addLogin")
      ss.pmLoginsAdded++;
    onObservation(strings.cheevos.pmLoginAdded, data == "addLogin", "bronze");
    if (ss.pmLoginsAdded > 10)
      onObservation(strings.cheevos.pmLoginAdded, data == "addLogin", "silver");
  }

  function onBookmarkAdded() {
    ss.bookmarksAdded++;
    onObservation(strings.cheevos.bookmarkAdded, true, "bronze");
    if (ss.bookmarksAdded > 100)
      onObservation(strings.cheevos.bookmarkAdded, true, "silver");
    if (ss.bookmarksAdded > 1000)
      onObservation(strings.cheevos.bookmarkAdded, true, "gold");
  }

  function clearOldBuckets() {
    const date = new Date(),
          milliseconds = date.getTime(),
          threeMinutesAsMS = 180000;
    for (let bucket in ss.hostCount) {
      for (let i in ss.hostCount[bucket]) {
        if (milliseconds - (ss.hostCount[bucket])[i] > threeMinutesAsMS)
          ss.hostCount[bucket] = {};
        break;
      }
    }
  }
  
  function trackHost(url) {
    let visited;
    const date = new Date(),
          minutes = date.getMinutes(),
          milliseconds = date.getTime(),
          threeMinutesAsMS = 180000,
          host = urlFactory.URL(url).host;
    for (let bucket in ss.hostCount)
      if (host in ss.hostCount[bucket]) {
        visited = true;
        break;
      }
    if (!visited) {
      let bucket = minutes % 3;
      (ss.hostCount[bucket])[host] = milliseconds;
    }
  }
  
  function getHostCount() {
    let hosts = 0;
    for (let bucket in ss.hostCount) {
      for (let i in ss.hostCount[bucket]) {
        hosts++;
      }
    }
    log("totalHosts: " + hosts);
    return hosts;
  }

	
  function onDOMContentLoaded(tab) {
    log("onDOMContentLoaded: " + tab.url);

    if (tab.url.toLowerCase() == aboutCheevosUrl) {
      onCheevosPageOpened(tab);
      return;
    }

    url = urlFactory.URL(tab.url);
    for (let index in strings.cheevos) {
      if ("url" in strings.cheevos[index]) {
        var pattern = new MatchPattern(strings.cheevos[index].url);
        if (pattern.test(tab.url)) {
          if (strings.cheevos[index] == strings.cheevos.addOnsOpened)
            onObservation(strings.cheevos.addOnsOpened, true, "silver");
          else
            onURLOpened(strings.cheevos[index]);
        }
      }
    }

    if (tab.url.toLowerCase().indexOf("about:") == 0 &&
        tab.url.toLowerCase() != "about:home" &&
        tab.url.toLowerCase() != "about:blank" &&
        tab.url.toLowerCase() != "about:privatebrowsing" &&
        tab.url.toLowerCase() != "about:sessionrestore" &&
        !(tab.url.toLowerCase() in ss.aboutsVisited)) {
      ss.aboutsVisited[tab.url.toLowerCase()] = true;
      ss.aboutsVisitedCount++;
      if (ss.aboutsVisitedCount >= 3)
        onObservation(strings.cheevos.aboutMisc, true, "bronze");
      if (ss.aboutsVisitedCount >= 9)
        onObservation(strings.cheevos.aboutMisc, true, "silver");
      if (ss.aboutsVisitedCount >= 19)
        onObservation(strings.cheevos.aboutMisc, true, "gold");
    }

	//to add another site:
	//   1. add the pattern to the patternArray below
	var patternArray = ["*.facebook.com", 
						"*.twitter.com",
						"*.linkedin.com",
						"*.myspace.com",
						"*.ning.com",
						"*.plus.google.com",
						"*.tagged.com",
						"*.orkut.com",
						"*.hi5.com"]
    if (ss.socialSites) {
      ss.socialSites = false;
      ss.awards = [0,0,0];
      ss.sites = [];
      for (var i=0; i < patternArray.length; i++)
        ss.sites[i] = 0;
      }
    var patterns = new Object();
    for (var i=0; i < patternArray.length; i++) {
      patterns[i] = new MatchPattern(patternArray[i]);
      if (patterns[i].test(tab.url)) {
        ss.sites[i]++; 
        log('+1 : ' + patternArray[i]);
        log(ss.sites);
        if (ss.sites[i] == 10) 
          ss.awards[0]++;
          if (ss.awards[0] >= 3) //checks for 10 visits to at least 3 sites
            onObservation(strings.cheevos.socialKing, true, "bronze");
        else if (ss.sites[i] == 20) 
          ss.awards[1]++;
          if (ss.awards[1] >= 3) //checks for 20 visits to at least 3 sites
            onObservation(strings.cheevos.socialKing, true, "silver");
        else if (ss.sites[i] == 30)
          ss.awards[2]++;
          if (ss.awards[2] >= 3) //checks for 30 visits to at least 3    sites
            onObservation(strings.cheevos.socialKing, true, "gold");
      }
    }
	
	clearOldBuckets();
	
    trackHost(tab.url);
    let hosts = getHostCount();
    if (hosts >= 10)
      onObservation(strings.cheevos.frequentFlyer, true, "bronze");
    if (hosts >= 20)
      onObservation(strings.cheevos.frequentFlyer, true, "silver");
    if (hosts >= 30)
      onObservation(strings.cheevos.frequentFlyer, true, "gold");
  }

  var windowDelegate = {
    onTrack: function (window) {
      function addMenuItem(window) {
        if (window.location != "chrome://browser/content/browser.xul")
          return;

        log("adding menu item");
        const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
        const keysetID = "cheevo-keyset";
        const keyID = "Cheevo:Cheevo";
        const fileMenuitemID = "menu_CheevoItem";
        let logo = data.url("trophy_icon.png");
        var $ = function(id) window.document.getElementById(id);

        function removeMI(id) {
          var menuitem = $(id);
          menuitem && menuitem.parentNode.removeChild(menuitem);
        }
        removeMI(fileMenuitemID);
        removeMI("appmenu_CheevoItem");

        // add the new menuitem to File menu
        let (cheevoMI = window.document.createElementNS(NS_XUL, "menuitem")) {
          cheevoMI.setAttribute("id", fileMenuitemID);
          cheevoMI.setAttribute("class", "menuitem-iconic");
          cheevoMI.setAttribute("label","View Cheevos");
          cheevoMI.setAttribute("key", keyID);
          cheevoMI.style.listStyleImage = "url('" + logo + "')";
          cheevoMI.addEventListener("command", function() { loadCheevosPage(); }, true);

          if ($("menu_ToolsPopup"))
            $("menu_ToolsPopup").insertBefore(cheevoMI, $("devToolsSeparator"));

          // add app menu item to Firefox button for Windows 7
          let appMenu = $("appmenuSecondaryPane"), cheevoAMI;
          if (appMenu) {
            cheevoAMI = $(fileMenuitemID).cloneNode(false);
            cheevoAMI.setAttribute("id", "appmenu_CheevoItem");
            cheevoAMI.setAttribute("class", "menuitem-iconic menuitem-iconic-tooltip");
            cheevoAMI.style.listStyleImage = "url('" + logo + "')";
            cheevoAMI.addEventListener("command", function() { loadCheevosPage(); }, true);
            appMenu.insertBefore(cheevoAMI, $("appmenuSecondaryPane-spacer"));
          }
        }
      }
      function addCustomizationEventListener(window) {
        function acquireGoldAddonsAchievement() {
          onObservation(strings.cheevos.addOnsOpened, true, "bronze");
          onObservation(strings.cheevos.addOnsOpened, true, "silver");
          onObservation(strings.cheevos.addOnsOpened, true, "gold");
        }
        if (window.location == "chrome://browser/content/browser.xul")
          window.addEventListener("aftercustomization", function() { acquireGoldAddonsAchievement(); }, false);

        // add unloader to unload+'s queue
        var unloadFunc = function() {
          // todo: this event listener isn't being removed
          //window.removeEventListener("aftercustomization", acquireGoldAddonsAchievement, false);
        };
        var index = destroyFuncs.push(unloadFunc) - 1;
        listen(window, window, "unload", function() {
          destroyFuncs[index] = null;
        }, false);
        unloaders.push(unload(unloadFunc, window));
      }
      log("window opened: " + window.location);
      addMenuItem(window);
      addCustomizationEventListener(window);
      if (window.location == "chrome://mozapps/content/preferences/changemp.xul")
        onObservation(strings.cheevos.pmLoginAdded, true, "gold");
      if (window.location == "chrome://browser/content/preferences/preferences.xul")
        onObservation(strings.cheevos.configOpened, true, "bronze");
      if (window.location == "chrome://browser/content/aboutDialog.xul") {
        let prefService = Cc["@mozilla.org/preferences-service;1"]
                          .getService(Ci.nsIPrefService);
        let defaults = prefService.getBranch("");
        let currentChannel = defaults.getCharPref("app.update.channel");
        if (currentChannel == "beta")
          onObservation(strings.cheevos.releaseChannels, true, "bronze");
        if (currentChannel == "aurora") {
          onObservation(strings.cheevos.releaseChannels, true, "bronze");
          onObservation(strings.cheevos.releaseChannels, true, "silver");
        }
        if (currentChannel == "nightly" || currentChannel == "nightly-ux") {
          onObservation(strings.cheevos.releaseChannels, true, "bronze");
          onObservation(strings.cheevos.releaseChannels, true, "silver");
          onObservation(strings.cheevos.releaseChannels, true, "gold");
        }
      }
      if (window.location == "chrome://browser/content/scratchpad.xul" ||
          window.location == "chrome://global/content/console.xul" ||
          window.location == "chrome://global/content/viewSource.xul") {
        ss.scratchPadOpenings += window.location == "chrome://browser/content/scratchpad.xul" ? 1 : 0;
        ss.errorConsoleOpenings += window.location == "chrome://global/content/console.xul" ? 1 : 0;
        ss.viewSourceOpenings += window.location == "chrome://global/content/viewSource.xul" ? 1 : 0;
        onObservation(strings.cheevos.devTools, true, "bronze");
        if (ss.scratchPadOpenings > 10 ||
            ss.errorConsoleOpenings > 10 ||
            ss.viewSourceOpenings > 10)
          onObservation(strings.cheevos.devTools, true, "silver");
        if (ss.scratchPadOpenings > 15 &&
            ss.errorConsoleOpenings > 15 &&
            ss.viewSourceOpenings > 15)
          onObservation(strings.cheevos.devTools, true, "gold");
      }
    },
    onUntrack: function (window) {
      if (window.location == "chrome://browser/content/browser.xul") {
        log("removing menu item");
        const fileMenuitemID = "menu_CheevoItem";
        var $ = function(id) window.document.getElementById(id);
        var menuitem = $(fileMenuitemID);
        menuitem && menuitem.parentNode.removeChild(menuitem);
      }

      // run unload functions
      destroyFuncs.forEach(function(f) f && f());
      destroyFuncs.length = 0;

      // remove unload functions from unload+'s queue
      unloaders.forEach(function(f) f());
      unloaders.length = 0;
    }
  };
  var tracker = new winUtils.WindowTracker(windowDelegate);

  var myPrefObserver = {
    register: function() {
      // First we'll need the preference services to look for preferences.
      var prefService = Cc["@mozilla.org/preferences-service;1"]
                          .getService(Ci.nsIPrefService);

      // For this._branch we ask that the preferences for extensions.myextension. and children
      this._branch = prefService.getBranch("");

      // Now we queue the interface called nsIPrefBranch2. This interface is described as:
      // "nsIPrefBranch2 allows clients to observe changes to pref values."
      this._branch.QueryInterface(Ci.nsIPrefBranch2);

      // Finally add the observer.
      this._branch.addObserver("", this, false);
    },

    unregister: function() {
      if (!this._branch) return;
      this._branch.removeObserver("", this);
    },

    observe: function(aSubject, aTopic, aData) {
      if(aTopic != "nsPref:changed") return;
      // aSubject is the nsIPrefBranch we're observing (after appropriate QI)
      // aData is the name of the pref that's been changed (relative to aSubject)
      switch (aData) {
        case strings.cheevos.homepageChanged.obs:
          onObservation(strings.cheevos.homepageChanged, true);
          break;
      }
    }
  };
  myPrefObserver.register();

  var bmsvc = Cc["@mozilla.org/browser/nav-bookmarks-service;1"]
                .getService(Ci.nsINavBookmarksService);
  var myExt_bookmarkListener = {
    onBeforeItemRemoved: function() {},
    onBeginUpdateBatch: function() {},
    onEndUpdateBatch: function() {},
    onFolderAdded: function() {},
    onFolderChanged: function() {},
    onFolderMoved: function() {},
    onFolderRemoved: function() {},
    onItemAdded: function(aItemId, aParentId, aIndex, aItemType, aURI) { if (!PlacesUtils.itemIsLivemark(aParentId)) onBookmarkAdded(); },
    onItemChanged: function() {},
    onItemMoved: function() {},
    onItemRemoved: function() {},
    onItemReplaced: function() {},
    onItemVisited: function() {},
    onSeparatorAdded: function() {},
    onSeparatorRemoved: function() {}
  };
  bmsvc.addObserver(myExt_bookmarkListener, false);

  let aboutCheevosHandler = protocol.about('cheevos', {
    onRequest: function(request, response) {
      log("about cheevos request");
      response.uri = data.url("cheevo.html");
    }
  });
  aboutCheevosHandler.register();
};
