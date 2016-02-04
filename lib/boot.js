
import React from 'react'
import App from './app'
import simperium from './simperium'
import store from './flux/store'
import appState from './flux/app-state'
import analytics from './analytics'
import { Auth } from 'simperium'
import { parse } from 'cookie'
import { render } from 'react-dom'
import { Provider } from 'react-redux'

const cookie = parse( document.cookie );
const auth = new Auth( config.app_id, config.app_key );

require( '../scss/app.scss' );

const token = cookie.token || localStorage.access_token;
const appId = config.app_id;

// If no token, and no app key, we're probably on the server, so redirect to simplenote login
if ( !token && !config.app_key ) {
	window.location = 'https://app.simplenote.com/signin';
}

const client = simperium( appId, token, {
	note: {
		beforeIndex: function( note ) {
			if ( note.data && note.data.systemTags ) {
				note.pinned = note.data.systemTags.indexOf( 'pinned' ) !== -1 ? 1 : 0;
			} else {
				note.pinned = 0;
			}
			return note;
		},
		configure: function( objectStore ) {
			objectStore.createIndex( 'modificationDate', 'data.modificationDate' );
			objectStore.createIndex( 'pinned-sort', ['pinned', 'data.modificationDate'] );
		}
	},
	tag: function( objectStore ) {
		console.log( 'Configure tag', objectStore );
	}
}, 'simplenote', 40 );

const l = ( msg ) => {
	return function() {
		// if (window.loggingEnabled)
		console.log.apply( console, [msg].concat( [].slice.call( arguments ) ) );
	}
}

client
	.on( 'connect', l( 'Connected' ) )
	.on( 'disconnect', l( 'Not connected' ) )
	// .on( 'message', l('<=') )
	// .on( 'send', l('=>') )
	.on( 'unauthorized', l( 'Not authorized' ) );

client.on( 'unauthorized', () => {
	// if there is no token, drop data, if there is a token it could potentially just be
	// a password change or something similar so don't kill the data
	if ( token ) {
		return;
	}

	client.reset().then( () => {
		console.log( 'Reset complete' )
	} );
} );

const app = document.createElement( 'div' );

document.body.appendChild( app );

let props = {
	client: client,
	noteBucket: client.bucket( 'note' ),
	tagBucket: client.bucket( 'tag' ),
	onAuthenticate: ( username, password ) => {
		auth.authorize( username, password ).then( user => {
			store.dispatch( appState.action( 'setAccountName', {
				accountName: username
			} ) );
			localStorage.access_token = user.access_token;
			client.setUser( user );
			analytics.tracks.recordEvent( 'user_signed_in' );
		} );
	},
	onSignOut: () => {
		delete localStorage.access_token;
		client.deauthorize();
		if ( config.signout ) {
			config.signout( function() {
				window.location = '/';
			} );
		}
		analytics.tracks.recordEvent( 'user_signed_out' );
	}
};

render(
	<Provider store={store}>
		<App {...props} />
	</Provider>,
	app
);