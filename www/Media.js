/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

var argscheck = require('cordova/argscheck'),
    utils = require('cordova/utils'),
    exec = require('cordova/exec');

var mediaObjects = {};

/**
 * This class provides access to the device media, interfaces to both sound and video
 *
 * @constructor
 * @param src                   The file name or url to play
 * @param successCallback       The callback to be called when the file is done playing or recording.
 *                                  successCallback()
 * @param errorCallback         The callback to be called if there is an error.
 *                                  errorCallback(int errorCode) - OPTIONAL
 * @param statusCallback        The callback to be called when media status has changed.
 *                                  statusCallback(int statusCode) - OPTIONAL
 */
var Media = function(src, successCallback, errorCallback, statusCallback, createdCallback) {
    argscheck.checkArgs('sFFFF', 'Media', arguments);
    this.id = utils.createUUID();
    mediaObjects[this.id] = this;
    this.src = src;
    this.successCallback = successCallback;
    this.errorCallback = errorCallback;
    this.statusCallback = statusCallback;
    this._duration = -1;
    this._position = -1;
    exec(createdCallback, this.errorCallback, "Media", "create", [this.id, this.src]);
};

// Media messages
Media.MEDIA_STATE = 1;
Media.MEDIA_DURATION = 2;
Media.MEDIA_POSITION = 3;
Media.MEDIA_ERROR = 9;

// Media states
Media.MEDIA_NONE = 0;
Media.MEDIA_STARTING = 1;
Media.MEDIA_RUNNING = 2;
Media.MEDIA_PAUSED = 3;
Media.MEDIA_STOPPED = 4;
Media.MEDIA_MSG = ["None", "Starting", "Running", "Paused", "Stopped"];

// "static" function to return existing objs.
Media.get = function(id) {
    return mediaObjects[id];
};

Media.forceStop = function () {
    for (var k in mediaObjects) {
        mediaObjects[k].stop();
        mediaObjects[k].release();
        delete mediaObjects[k];
    }
};

function mediaExec (nativeMethod, getOptions, getCallback, getErrorCallback) {
    getCallback = (getCallback || nothing);
    getErrorCallback = (getErrorCallback || nothing);

    return function() {
        var args = Array.prototype.slice.apply(arguments);
        exec(
            getCallback(this, args),
            getErrorCallback(this, args),
            "Media",
            nativeMethod,
            getOptions(this, args));
    };
}

function nothing() { return null; }
function id(self) { return [self.id]; }
function defaultErrorCallback(self) { return self.errorCallback; }

function oneArgument(player, args){ return [player.id, args[0]];}

function src(player) { return [player.id, player.src];}

function success(player, args) { return args[0]; }
function fail(player, args) { return args[1]; }

/**
 * Start or resume playing audio file.
 */
Media.prototype.play = mediaExec("startPlayingAudio", function(player, args) {
    return [player.id, player.src, args[1]];
}, success);

/**
 * Stop playing audio file.
 */
Media.prototype.stop = mediaExec(
    "stopPlayingAudio",
    id,
    function(player) { return function() { player._position = 0; }; },
    defaultErrorCallback);

/**
 * Seek or jump to a new time in the track..
 */
Media.prototype.seekTo = mediaExec(
    "seekToAudio",
    oneArgument,
    function(player, args) {return function(p) { player._position = p; args[1](p); };},
    function(player, args){ return args[2];});

/**
 * Pause playing audio file.
 */
Media.prototype.pause = mediaExec(
    "pausePlayingAudio", id, nothing, defaultErrorCallback);

/**
 * Get duration of an audio file.
 * The duration is only set for audio that is playing, paused or stopped.
 *
 * @return      duration or -1 if not known.
 */
Media.prototype.getDuration = function() {
    return this._duration;
};

/**
 * Get position of audio.
 */
Media.prototype.getCurrentPosition = mediaExec(
    "getCurrentPositionAudio",
    id,
    function(player, args) {return function(p) { player._position = p; args[0](p)}},
    fail);

/**
 * Start recording audio file.
 */
Media.prototype.startRecord = mediaExec("startRecordingAudio",
    src,
    nothing,
    defaultErrorCallback);

/**
 * Stop recording audio file.
 */
Media.prototype.stopRecord = mediaExec("stopRecordingAudio", id, nothing, defaultErrorCallback);

/**
 * Pause recording audio file.
 */
Media.prototype.pauseRecord = mediaExec("pauseRecordingAudio", id, nothing, defaultErrorCallback);

/**
* Resume recording audio file.
*/
Media.prototype.resumeRecord = mediaExec("resumeRecordingAudio", id, nothing, defaultErrorCallback);

/**
 * Release the resources.
 */
Media.prototype.release = mediaExec("release", id, function (self) {
   delete mediaObjects[self.id];
}, defaultErrorCallback);

/**
 * Adjust the volume.
 */
Media.prototype.setVolume = mediaExec("setVolume", oneArgument);

/**
 * Adjust the playback rate.
 */
Media.prototype.setRate = mediaExec("setRate", oneArgument);

/**
 * Get amplitude of audio.
 */
Media.prototype.getCurrentAmplitude = mediaExec("getCurrentAmplitudeAudio",
    id,
    success,
    fail);

/**
 * Audio has status update.
 * PRIVATE
 *
 * @param id            The media object id (string)
 * @param msgType       The 'type' of update this is
 * @param value         Use of value is determined by the msgType
 */
Media.onStatus = function(id, msgType, value) {

    var media = mediaObjects[id];

    if (media) {
        switch(msgType) {
            case Media.MEDIA_STATE :
                if (media.statusCallback) {
                    media.statusCallback(value);
                }
                if (value == Media.MEDIA_STOPPED) {
                    if (media.successCallback) {
                        media.successCallback();
                    }
                }
                break;
            case Media.MEDIA_DURATION :
                media._duration = value;
                break;
            case Media.MEDIA_ERROR :
                if (media.errorCallback) {
                    media.errorCallback(value);
                }
                break;
            case Media.MEDIA_POSITION :
                media._position = Number(value);
                break;
            default :
                if (console.error) {
                    console.error("Unhandled Media.onStatus :: " + msgType);
                }
                break;
        }
    } else if (console.error) {
        console.error("Received Media.onStatus callback for unknown media :: " + id);
    }

};

module.exports = Media;

function onMessageFromNative(msg) {
    if (msg.action == 'status') {
        Media.onStatus(msg.status.id, msg.status.msgType, msg.status.value);
    } else {
        throw new Error('Unknown media action' + msg.action);
    }
}

if (cordova.platformId === 'android' || cordova.platformId === 'amazon-fireos' || cordova.platformId === 'windowsphone') {

    var channel = require('cordova/channel');

    channel.createSticky('onMediaPluginReady');
    channel.waitForInitialization('onMediaPluginReady');

    channel.onCordovaReady.subscribe(function() {
        exec(onMessageFromNative, undefined, 'Media', 'messageChannel', []);
        channel.initializationComplete('onMediaPluginReady');
    });
}
