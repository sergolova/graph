'use strict'

function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    let date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function getCookie(name) {
  let nameEQ = name + "=";
  let ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i].trim();
    if (c.startsWith(nameEQ)) {
      return c.substring(nameEQ.length, c.length)
    }
  }
  return null;
}

function cookieExists(name) {
  return getCookie(name) !== null;
}

function eraseCookie(name) {
  document.cookie = name + '=; Max-Age=-99999999;';
}