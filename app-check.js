(function(){
  'use strict';
  var siteKey='6Leuoe0tAAAAAP8ADVtuxdiFFR5b3xWbeWwAogg9';
  window.FollowupAppCheck={
    activate:function(app){
      if(!window.firebase||!firebase.appCheck)throw Error('App Check library unavailable');
      var check=app.appCheck();
      check.activate(new firebase.appCheck.ReCaptchaEnterpriseProvider(siteKey),true);
      // Monitoring phase: failure is recorded without interrupting existing users.
      check.getToken(false).then(function(){document.documentElement.dataset.appCheck='verified';})
        .catch(function(error){document.documentElement.dataset.appCheck='unverified';console.warn('App Check verification failed:',error.code||'unknown');});
      return check;
    }
  };
})();
