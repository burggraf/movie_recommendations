import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

export const createCompletion = async (prompt: string) => {
  const response = await fetch(
      `https://api.openai.com/v1/engines/text-davinci-003/completions`,
      {
        body: JSON.stringify({
          prompt: prompt,
          temperature: 0.5,
          max_tokens: 512,
          top_p: 1,
          frequency_penalty: 0.52,
          presence_penalty: 0.5,
          best_of: 1
        }),
        headers: {
          Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );
    return response.text();    
}
const headers = {
  "Content-Type": "application/json",
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  const { movies } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    // Create client with Auth context of the user that called the function.
    // This way your row-level-security (RLS) policies are applied.
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new Response(
      JSON.stringify({data: null, error: 'User not found'}),
      { headers, status: 200 },
    )
  }

  const { data: movieListData, error: movieListError } = await supabase
  .from('movies')
  .select('*')
  .eq('userid', user.id)
  .limit(1)
  .single();
  if (movieListError) {
    return new Response(
      JSON.stringify({data: null, error: movieListError}),
      { headers, status: 200 },
    )
  } else {
    // rate limit to 1 request per 60 seconds
    if (movieListData?.updated && new Date(movieListData.updated).getTime() + 60000 > new Date().getTime()) {
        return new Response(
          JSON.stringify({data: null, error: 'Rate limit exceeded, please try again later'}),
          { headers, status: 200 },
        )
    }
    const movieList = movieListData?.favorites?.join(', ')
    const fullPrompt = `I enjoyed the following movies: ${movieList}. Can you suggest some other movies I might like? Please format the results with one movie per line.`
    const result = await createCompletion(fullPrompt)
    try {
      const jsonData: any = JSON.parse(result)
      let results = jsonData.choices[0].text
      results = results.replace(/^[\n]+/, '')
      const { data: recommendationsData, error: recommendationsError } = await supabase
      .from('movies')
      .upsert({ recommendations: results, userid: user.id, updated: 'NOW()' })
      .select('recommendations');
      return new Response(
        JSON.stringify({data: recommendationsData, error: recommendationsError}),
        { headers, status: 200 },
      )
    } catch (err) {
      return new Response(
        JSON.stringify({data: null, error: err}),
        { headers, status: 200 },
      )
    }
  }

})

