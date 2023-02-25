import "index.css"
import "syntax-highlighting.css"
import * as Turbo from "@hotwired/turbo"

import '@shoelace-style/shoelace/dist/components/card/card.js';
import '@shoelace-style/shoelace/dist/components/avatar/avatar.js';
import '@shoelace-style/shoelace/dist/components/tag/tag.js';

import { setBasePath } from "@shoelace-style/shoelace/dist/utilities/base-path.js"
setBasePath("/shoelace-assets")

import components from "bridgetownComponents/**/*.{js,jsx,js.rb,css}"

