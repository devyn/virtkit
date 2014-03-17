require 'bundler'

Bundler.setup(:default)

require 'sinatra'
require 'erb'
require 'json'

get '/' do
  erb :index
end
