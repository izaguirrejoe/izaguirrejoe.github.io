---
layout: post
title:  "Navigation in a Turbo Native App"
date:   2022-11-29 
tags: Turbo Turbo_Native 
description: "Using the Native routes provided in turbo-rails gem"
template_engine: md
---

There's a very little talked about part of the `turbo-rails` gem, [tucked away deep into the source code](https://github.com/hotwired/turbo-rails/blob/main/app/controllers/turbo/native/navigation.rb). It's called `navigation.rb`, which at first glance is a little bit cryptic, but it's foundational to any complex Turbo Native app. It's short enough to include here in it's entirety, for your convenience: 


```ruby
module Turbo::Native::Navigation
  private

  def recede_or_redirect_to(url, **options)
    turbo_native_action_or_redirect url, :recede, :to, options
  end

  def resume_or_redirect_to(url, **options)
    turbo_native_action_or_redirect url, :resume, :to, options
  end

  def refresh_or_redirect_to(url, **options)
    turbo_native_action_or_redirect url, :refresh, :to, options
  end


  def recede_or_redirect_back_or_to(url, **options)
    turbo_native_action_or_redirect url, :recede, :back, options
  end

  def resume_or_redirect_back_or_to(url, **options)
    turbo_native_action_or_redirect url, :resume, :back, options
  end

  def refresh_or_redirect_back_or_to(url, **options)
    turbo_native_action_or_redirect url, :refresh, :back, options
  end

  # :nodoc:
  def turbo_native_action_or_redirect(url, action, redirect_type, options = {})
    if turbo_native_app?
      redirect_to send("turbo_#{action}_historical_location_url", notice: options[:notice] || options.delete(:native_notice))
    elsif redirect_type == :back
      redirect_back fallback_location: url, **options
    else
      redirect_to url, options
    end
  end

  # Turbo Native applications are identified by having the string "Turbo Native" as part of their user agent.
  def turbo_native_app?
    request.user_agent.to_s.match?(/Turbo Native/)
  end
end
```

There are accompanying [controller](https://github.com/hotwired/turbo-rails/blob/main/app/controllers/turbo/native/navigation_controller.rb) and [routes](https://github.com/hotwired/turbo-rails/blob/main/config/routes.rb) files:

```ruby
#Controller
class Turbo::Native::NavigationController < ActionController::Base
  def recede
    render html: "Going back…"
  end

  def refresh
    render html: "Refreshing…"
  end

  def resume
    render html: "Staying put…"
  end
end

#Routes
Rails.application.routes.draw do
  get "recede_historical_location"  => "turbo/native/navigation#recede",  as: :turbo_recede_historical_location
  get "resume_historical_location"  => "turbo/native/navigation#resume",  as: :turbo_resume_historical_location
  get "refresh_historical_location" => "turbo/native/navigation#refresh", as: :turbo_refresh_historical_location
end
```

So there are three components that are given to us in the `turbo-rails` gem: **helper methods**, a **controller**, and **routes.** But what are these for?

Let's start with the routes. `turbo-rails` creates three new routes to use in your rails app: **recede, resume, and refresh**. These routes map to the three controller actions shown above, but these actions don't actually *do anything*. They're not meant to. These are dummy routes meant to be called by your Turbo Native client, which should map to Native navigations, such as popping view controllers, or actions such as reloading the webview. 

Why are these necessary? Consider a Rails app with `Group`s that have `Post`s, with the following post creation flow:

![normal navigation](https://res.cloudinary.com/dddjom6k3/image/upload/v1669768980/normal-nav_tjg0qo.png)

```ruby
#The post controller as it stands
class PostsController < ApplicationController
# ...
  def create
    @post = current_user.posts.build(post_params)
    @post.group_id = @group.id
      if @post.save
        flash[:success] = "Post Created : Post was successfully created."
        redirect_to @group, status: :see_other
      else
        render :new, status: :unprocessable_entity
      end
  end
# ...
end
```

This is fine for the web, but it looks strange in a native app:

![incorrect navigation](https://res.cloudinary.com/dddjom6k3/image/upload/v1669767660/group-post-incorrect_qkqpqb.gif)

We're stacking the group show page on top of the new post page, when what we actually wanted was to simply pop the post page to go back to the group page on succesfull post creation. This is the desired post creation flow *on a Native app*:

![native navigation](https://res.cloudinary.com/dddjom6k3/image/upload/v1669768980/native-nav_cgmnx4.png)

How do we acheive the desired navigation flow? **This is where the helpers shown in the beginning of the article come in.**

Let's break down the core method of `navigation.rb`:

```ruby
  def turbo_native_action_or_redirect(url, action, redirect_type, options = {})
    if turbo_native_app?
      redirect_to send("turbo_#{action}_historical_location_url", notice: options[:notice] || options.delete(:native_notice))
    elsif redirect_type == :back
      redirect_back fallback_location: url, **options
    else
      redirect_to url, options
    end
  end
```

This helper method does the following:

1. If this is a Turbo Native app, the client is redirected to the `action` parameter passed in. This will redirect to one of the dummy routes (recede, refresh, or resume). It's the responsibility of the Turbo Native client to handle the route appropriately.

2. If it's not a Turbo Native app, it must be a Web Browser. If the redirect type is :back, it will issue a `redirect_back` to the browser. `redirect_back` [is discussed in the Rails docs.](https://apidock.com/rails/v5.0.0.1/ActionController/Redirecting/redirect_back)

3. If it's not a Turbo Native app and a `redirect_back` is not desired, it falls back to a standard `redirect_to`.

So this method **dynamically generates an appropriate redirect depending on if the client is a Turbo Native app or not**. How does the server know? It checks for "Turbo Native" in the User Agent. If it's not there, the server won't know, so be sure to include it client-side.

All of the other helper methods are convenience methods, so that we don't have to provide the parameters every time we want to use this method. Let's update the `redirect_to` in our Posts controller to handle Turbo Native requests!

First, let's include the Turbo Navigation module in our Application Helper so we can use the helpers:

```ruby
module ApplicationHelper
  include Turbo::Native::Navigation
#...
end

```

```ruby
#The updated Post Controller
class PostsController < ApplicationController
# ...
  def create
    @post = current_user.posts.build(post_params)
    @post.group_id = @group.id
      if @post.save
        flash[:success] = "Post Created : Post was successfully created."
        recede_or_redirect_to @group, status: :see_other
      else
        render :new, status: :unprocessable_entity
      end
  end
# ...
end
```

Turbo Native clients will now receive a redirect to the `recede` route. Let's look at how an iOS app could handle a redirect like this. Suppose you have a TurboNavigationController [similar to the one in the Turbo iOS demo](https://github.com/hotwired/turbo-ios/blob/main/Demo/Navigation/TurboNavigationController.swift). Let's rewrite the `route` function to look something like this:

```swift
func route(url: URL, options: VisitOptions, properties: PathProperties) {
    if presentedViewController != nil {
        dismiss(animated: true)
    }
    
    if url.path == "/recede_historical_location"{
        popViewController(animated: true)
        return
    }
    
    if url.path == "/resume_historical_location"{
        return
    }
    
    if url.path == "/refresh_historical_location"{
        self.session.reload()
        return
    }
    
    let viewController = makeViewController(for: url, properties: properties)
    navigate(to: viewController, action: options.action, properties: properties)
    visit(viewController: viewController, with: options, modal: isModal(properties))
}
```

This will interrupt the routing if a visit is proposed to any of the three dummy routes, and take appropriate action. In the case of the `recede` route, we're going to simply pop the view controller. Here's what the final result looks like. 

![correct navigation](https://res.cloudinary.com/dddjom6k3/image/upload/v1669767504/group-post-correct_zgaxhr.gif)

The power of this method is that we continue with the same Post controller as before, simply changing `redirect_to` to `recede_or_redirect_to` upon successfull post creation. You now have a majestic monolith, elegantly adapting to both web browsers and Turbo Native apps.

*Wondering how I got those cool toast notifications popping up? [Check out my article on toast notifications with Shoelace and Turbo.](https://izaguirrejoe.dev/2022/11/09/toast-alerts-shoelace-stimulus/)*
