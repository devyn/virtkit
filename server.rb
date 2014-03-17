require 'bundler'

Bundler.setup(:default)

require 'sinatra'
require 'sinatra-websocket'
require 'erb'
require 'json'
require 'thread'

class SocketClosed < StandardError; end

class Session
  def initialize
  end

  def start(stream)
    @stream = stream

    stream << "\nLogin: "

    username = stream.gets.chomp

    stream.echo = false
    stream << "Password: "

    password = stream.gets.chomp
    stream.echo = true

    p [username, password]

    stream << "\n\nWelcome, #{username}!\n\n"

    catch :close do
      loop do
        stream << "/> "
        command = stream.gets.chomp.split(" ")

        case command[0]
        when "ls"
          stream.puts "egg1.txt egg2.txt egg3.txt"
        when "cat"
          case command[1]
          when "egg1.txt"
            stream.puts <<-EOF
"What... what happened?" You asked. "Where am I?"
"You died," I said, matter-of-factly. No point in mincing words.
"There was a... a truck and it was skidding..."
"Yup," I said.
"I... I died?"
"Yup. But don't feel bad about it. Everyone dies," I said.
EOF
          when "egg2.txt"
            stream.puts <<-EOF
You looked around. There was nothingness. Just you and me. "What is this place?"
You asked. "Is this the afterlife?"
"More or less," I said.
"Are you god?" You asked.
"Yup," I replied. "I'm God."
"My kids... my wife," you said.
"What about them?"
"Will they be all right?"
"That's what I like to see," I said. "You just died and your main concern is for
your family. That's good stuff right there."
EOF
          when "egg3.txt"
            stream.puts <<-EOF
I stopped walking and took you by the shoulders. "Your soul is more magnificent,
beautiful, and gigantic than you can possibly imagine. A human mind can only
contain a tiny fraction of what you are. It's like sticking your finger in a
glass of water to see if it's hot or cold. You put a tiny part of yourself into
the vessel, and when you bring it back out, you've gained all the experiences it
had.
"You've been in a human for the last 48 years, so you haven't stretched out yet
and felt the rest of your immense consciousness. If we hung out here for long
enough, you'd start remembering everything. But there's no point to doing that
between each life."

-- The Egg by Andy Weir
EOF
          else
            stream.puts "cat: #{command[1]}: no such file or directory"
          end
        when "exit"
          stream.puts "Bye!"
          throw :close
        when "", nil
        else
          stream.puts "command not found: #{command[0]}"
          stream.puts "*pssst* try 'ls' and 'cat'"
        end
      end
    end
  end
end

class TerminalStream
  attr_accessor :echo

  def initialize(socket)
    @socket = socket

    @input_queue   = Queue.new
    @partial_input = ""

    @echo = true
  end

  def receive(message)
    if @echo
      unless message[0] == "\x08" and @partial_input.empty?
        @socket.send message
      end
    end
    @input_queue << message
  end

  def gets
    until @partial_input.include? "\n"
      @partial_input << @input_queue.shift

      while backspace_index = @partial_input.index("\x08")
        if backspace_index == 0
          @partial_input.slice!(0)
        else
          @partial_input.slice!(backspace_index - 1, 2)
        end
      end
    end

    @partial_input.slice!(0, @partial_input.index("\n") + 1)
  end

  def getc
    until @partial_input.length > 0
      @partial_input << @input_queue.shift
    end

    @partial_input.slice!(0)
  end

  def <<(s)
    EM.next_tick { @socket.send(s) }
  end

  def puts(s)
    EM.next_tick {
      if s[-1] == "\n"
        @socket.send(s)
      else
        @socket.send(s + "\n")
      end
    }
  end

  def close
    EM.next_tick { @socket.close_connection }
  end
end

set :sessions, []

set :protection, :except => :session_hijacking

get '/' do
  if not request.websocket?
    erb :index
  else
    request.websocket do |ws|
      msg_queue = Queue.new
      thread    = nil
      stream    = TerminalStream.new(ws)

      ws.onopen do
        session = Session.new

        Thread.start do
          begin
            session.start(stream)
          ensure
            stream.close
          end
        end

        settings.sessions << session
      end

      ws.onmessage do |message|
        stream.receive message
      end

      ws.onclose do
        thread.raise SocketClosed if thread and thread.alive?
      end
    end
  end
end
