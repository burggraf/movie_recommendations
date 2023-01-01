<script lang="ts">
	import { createClient, SupabaseClient } from '@supabase/supabase-js'
  	import { onMount } from 'svelte'
	const VITE_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
	const VITE_SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY
	const supabase: SupabaseClient = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_KEY)

	let email = ''
	let password = ''
	let errorMessage = ''
	let favorites = ''
	let recommendations: string = ''
	let user: any = null
	supabase.auth.onAuthStateChange((event, session) => {
		user = session?.user
	})

	const signin = async () => {
		const { data, error } = await supabase.auth.signInWithPassword({
			email: email,
			password: password,
		})
		if (error?.message) {
			errorMessage = error.message
		} else {
			errorMessage = ''
		}
	}
	const signup = async () => {
		const { data, error } = await supabase.auth.signUp({
			email: email,
			password: password,
		})
		if (error) {
			errorMessage = error?.message || "unknown error"
		} else {
			errorMessage = ''
		}
	}
	const signout = async () => {
		const { error } = await supabase.auth.signOut()
		if (error) {
			errorMessage = error?.message || "unknown error"
		} else {
			errorMessage = ''
		}
	}		
	const updateRecommendations = async () => {
		const favoritesArray = (favorites+'\n').split('\n');
		if (favoritesArray.length === 0) {
			errorMessage = 'at least one favorite movie is required'
			return
		}
		for (let x = favoritesArray.length-1; x >= 0; x--) {
			favoritesArray[x] = favoritesArray[x].trim()
			if (favoritesArray[x].length === 0) favoritesArray.splice(x, 1);
		}
		errorMessage = 'saving favorite movies...'
		const { error: saveFavoritesError } = 
			await supabase.from('movies').upsert({
				userid: user.id,
				favorites: favoritesArray
			})
		if (saveFavoritesError) { 
			console.error('saveFavoriteMovies error', saveFavoritesError);
			errorMessage = saveFavoritesError.message
			return
		} 
		errorMessage = 'getting recommendations...'
		const { data, error } = await supabase.functions.invoke('movie_recommendations', {
			body: {}
		})
		if (error) {
			errorMessage = error.message
		} else {
			if (data?.error) {
				errorMessage = data.error
			} else {
				recommendations = data.data[0].recommendations! || ''
				errorMessage = ''
			}
		}
	}
	const loadData = async () => {
		const { data, error } = await supabase.from('movies').select('*')
		if (error) {
			console.error('loadData', error)
			errorMessage = error.message
		} else {
			favorites = data[0]?.favorites?.join('\n') || ''
			recommendations = data[0]?.recommendations! || ''
		}
	}
	onMount(async () => {
		await loadData()
	})
</script>

<h1>Movie Recommendations</h1>
{#if user}
	<p>signed in as {user.email}</p>
	<button on:click={signout}>sign out</button> 
{:else}
	<table border={0}>
		<tr>
			<td style="text-align: right;">email:</td>
			<td><input type="email" bind:value={email} /></td>
		</tr>
		<tr>
			<td style="text-align: right;">password:</td>
			<td><input type="password" bind:value={password} /></td>
		</tr>
		<tr>
			<td>&nbsp;</td>
			<td style="text-align: right;">
				<button on:click={signin}>sign in</button>&nbsp;&nbsp;&nbsp;
				<button on:click={signup}>sign up</button></td>
		</tr>
	</table>
	 
	
{/if}
{#if errorMessage}
	<p style="color: red;">{errorMessage}</p>
{/if}
{#if user}
	<br/>
	my favorite movies (one movie per line):<br/>
	<textarea rows="15" cols="60" bind:value={favorites}></textarea><br/>
	<button on:click={updateRecommendations}>Get Movie Recommendations</button><br/>
	recommendations:<br/>
	<textarea disabled={true} rows="15" cols="60" bind:value={recommendations}></textarea><br/>
{/if}
